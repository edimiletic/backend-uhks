// backend/routes/kontrola.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // Make sure this line exists
const Kontrola = require('../models/Kontrola');
const BasketballGame = require('../models/BasketballGames');
const authenticateUser = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { canWriteKontrola } = require('../config/roles');

const requireKontrolaWriter = async (req, res, next) => {
  try {
    const gameId = req.body.gameId || req.params.gameId;
    if (!gameId) {
      return res.status(400).json({ error: 'gameId is required' });
    }

    const game = await BasketballGame.findById(gameId);
    if (!game) {
      return res.status(404).json({ error: 'Utakmica nije pronađena' });
    }

    if (!canWriteKontrola(req.user, game)) {
      return res.status(403).json({
        error: 'Kontrolu piše kontrolor. Ako kontrolor nije dodijeljen, piše je delegat utakmice.'
      });
    }

    next();
  } catch (error) {
    next(error);
  }
};

// Create kontrola
router.post('/', authenticateUser, requireKontrolaWriter, async (req, res) => {
  try {
    console.log('Creating kontrola for user:', req.user.name, 'Role:', req.user.role);
    console.log('Kontrola data received:', req.body);
    
    // Create the kontrola with notifications
    const kontrola = await Kontrola.createWithNotifications(req.body, req.user._id);
    
    console.log('✅ Kontrola created successfully:', kontrola._id);
    
    res.json({ 
      success: true, 
      message: 'Kontrola je uspješno kreirana',
      kontrola: kontrola,
      notificationsCount: req.body.refereeGrades?.length || 0
    });
    
  } catch (error) {
    console.error('❌ Error creating kontrola:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Kontrola već postoji za ovu utakmicu' });
    }
    
    res.status(500).json({ error: 'Greška pri kreiranju kontrole' });
  }
});

// Test route (keep for debugging)
router.get('/test', authenticateUser, (req, res) => {
  res.json({ message: 'Kontrola routes working', user: req.user.name, role: req.user.role });
});

// Get kontrola for referee
router.get('/referee/:gameId', authenticateUser, async (req, res) => {
   try {
    const { gameId } = req.params;
    const refereeId = req.user._id;
    
    console.log(`=== DEBUGGING KONTROLA FETCH ===`);
    console.log(`GameId: ${gameId}`);
    console.log(`Current user ID: ${refereeId}`);
    console.log(`Current user: ${req.user.name} ${req.user.surname}`);
    console.log(`Current user role: ${req.user.role}`);
    
    // First, check if kontrola exists at all
    const kontrolaExists = await Kontrola.findOne({ gameId });
    console.log(`Kontrola exists for game: ${!!kontrolaExists}`);
    
    if (kontrolaExists) {
      console.log(`Kontrola ID: ${kontrolaExists._id}`);
      console.log(`Number of referee grades: ${kontrolaExists.refereeGrades.length}`);
      
      // Log all referee IDs in the kontrola
      kontrolaExists.refereeGrades.forEach((grade, index) => {
        console.log(`Grade ${index}: refereeId=${grade.refereeId}, name=${grade.refereeName}, role=${grade.refereeRole}`);
        console.log(`ID match: ${grade.refereeId.toString() === refereeId.toString()}`);
      });
    }
    
    const kontrolaData = await Kontrola.getForReferee(gameId, refereeId);
    
    if (!kontrolaData) {
      console.log(`❌ No kontrola data returned for referee ${refereeId}`);
      return res.status(404).json({ error: 'Kontrola nije pronađena ili nemate dozvolu za pristup' });
    }
    
    console.log(`✅ Kontrola found for referee ${refereeId}`);
    console.log(`=== END DEBUG ===`);
    res.json(kontrolaData);
  } catch (error) {
    console.error('Error fetching kontrola for referee:', error);
    res.status(500).json({ error: 'Greška pri dohvaćanju kontrole' });
  }
});

// Check if kontrola exists
router.get('/exists/:gameId', authenticateUser, async (req, res) => {
  try {
    const { gameId } = req.params;
    const exists = await Kontrola.existsForGame(gameId);
    res.json({ exists });
  } catch (error) {
    console.error('Error checking kontrola existence:', error);
    res.status(500).json({ error: 'Greška pri provjeri postojanja kontrole' });
  }
});


// Get kontrola for editing (Admin/Delegat only)
router.get('/edit/:gameId', authenticateUser, requireKontrolaWriter, async (req, res) => {
  try {
    const { gameId } = req.params;
    
    console.log(`🔍 Getting kontrola for editing, gameId: ${gameId}`);
    console.log(`👤 Requested by: ${req.user.name} (${req.user.role})`);
    
    const kontrola = await Kontrola.findOne({ gameId })
      .populate('gameId')
      .populate('createdBy', 'name surname');
    
    if (!kontrola) {
      console.log(`❌ No kontrola found for gameId: ${gameId}`);
      return res.status(404).json({ error: 'Kontrola nije pronađena' });
    }
    
    console.log(`✅ Kontrola found:`, {
      id: kontrola._id,
      tezinaUtakmice: kontrola.tezinaUtakmice,
      refereeGradesCount: kontrola.refereeGrades.length
    });
    
    // Log each referee grade
    kontrola.refereeGrades.forEach((grade, index) => {
      console.log(`📝 Grade ${index}:`, {
        refereeId: grade.refereeId,
        refereeName: grade.refereeName,
        role: grade.refereeRole,
        hasAllFields: !!(grade.pogreske && grade.kontroliraniSudac)
      });
    });
    
    res.json(kontrola);
  } catch (error) {
    console.error('❌ Error fetching kontrola for editing:', error);
    res.status(500).json({ error: 'Greška pri dohvaćanju kontrole' });
  }
});

// Update kontrola (Admin/Delegat only)
router.put('/:gameId', 
  authenticateUser, 
  requireKontrolaWriter, 
  async (req, res) => {
    try {
      const { gameId } = req.params;
      
      const kontrola = await Kontrola.findOne({ gameId });
      
      if (!kontrola) {
        return res.status(404).json({ error: 'Kontrola nije pronađena' });
      }
      
      await kontrola.updateWithNotifications(req.body, req.user._id);
      
      res.json({ success: true, kontrola });
    } catch (error) {
      console.error('Error updating kontrola:', error);
      res.status(500).json({ error: 'Greška pri ažuriranju kontrole' });
    }
  }
);

// Delete kontrola (Admin only)
router.delete('/:gameId', 
  authenticateUser, 
  requireRole(['Admin']), 
  async (req, res) => {
    try {
      const { gameId } = req.params;
      
      const result = await Kontrola.deleteOne({ gameId });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Kontrola nije pronađena' });
      }
      
      res.json({ success: true, message: 'Kontrola je uspješno obrisana' });
    } catch (error) {
      console.error('Error deleting kontrola:', error);
      res.status(500).json({ error: 'Greška pri brisanju kontrole' });
    }
  }
);

// Get all kontrole for a specific game (Admin/Delegat only - to see all referee grades)
router.get('/game/:gameId/all', 
  authenticateUser, 
  requireKontrolaWriter, 
  async (req, res) => {
    try {
      const { gameId } = req.params;
      
      const kontrola = await Kontrola.findOne({ gameId })
        .populate('gameId')
        .populate('createdBy', 'name surname')
        .populate('updatedBy', 'name surname');
      
      if (!kontrola) {
        return res.status(404).json({ error: 'Kontrola nije pronađena' });
      }
      
      res.json(kontrola);
    } catch (error) {
      console.error('Error fetching full kontrola:', error);
      res.status(500).json({ error: 'Greška pri dohvaćanju kontrole' });
    }
  }
);

// GET - Get all kontrola data for statistics (Admin only)
// GET - Get all kontrola data for statistics (Admin only)
router.get('/statistics', 
  authenticateUser, 
  requireRole(['Admin']), 
  async (req, res) => {
    try {
      console.log('🔍 Getting all kontrola data for statistics');
      console.log('Query parameters received:', req.query);
      
      const { startDate, endDate, competition, role } = req.query;
      
      // Add mongoose import if missing
      const mongoose = require('mongoose');
      
      // Build match conditions for games
      let gameMatchConditions = {};
      let matchingGameIds = [];
      
      // Add date filter if provided
      if (startDate && endDate) {
        console.log('Adding date filter:', startDate, 'to', endDate);
        gameMatchConditions.date = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      // Add competition filter if provided
      if (competition) {
        console.log('Adding competition filter:', competition);
        gameMatchConditions.competition = competition;
      }
      
      console.log('Game match conditions:', gameMatchConditions);
      
      // Get game IDs that match the filters - FIXED: Use find() instead of distinct()
      try {
        const BasketballGame = mongoose.model('BasketballGame');
        
        if (Object.keys(gameMatchConditions).length > 0) {
          console.log('Searching games with conditions:', gameMatchConditions);
          // Use find() and map to get IDs instead of distinct()
          const matchingGames = await BasketballGame.find(gameMatchConditions, '_id');
          matchingGameIds = matchingGames.map(game => game._id);
          console.log('Found matching game IDs:', matchingGameIds.length);
        } else {
          console.log('No game filters, getting all games');
          // Use find() instead of distinct()
          const allGames = await BasketballGame.find({}, '_id');
          matchingGameIds = allGames.map(game => game._id);
          console.log('Found all game IDs:', matchingGameIds.length);
        }
      } catch (gameError) {
        console.error('Error finding games:', gameError);
        // If there's an issue with games, try to get all kontrolas without game filtering
        console.log('Proceeding without game filtering due to error');
        matchingGameIds = null; // This will make us skip game filtering
      }
      
      // Build kontrola query
      let kontrolaQuery = {};
      if (matchingGameIds && matchingGameIds.length > 0) {
        kontrolaQuery.gameId = { $in: matchingGameIds };
        console.log('Using game filter with', matchingGameIds.length, 'games');
      } else if (matchingGameIds && matchingGameIds.length === 0) {
        // No games match the criteria, so no kontrolas will match either
        console.log('No games match criteria, returning empty result');
        return res.json([]);
      } else {
        console.log('No game filtering applied');
      }
      
      console.log('Kontrola query:', kontrolaQuery);
      console.log('Searching for kontrolas...');
      
      // Find kontrolas for those games
      const kontrolas = await Kontrola.find(kontrolaQuery)
        .populate('gameId', 'homeTeam awayTeam date time venue competition')
        .populate('createdBy', 'name surname')
        .lean();
      
      console.log(`✅ Found ${kontrolas.length} kontrola records`);
      
      // Filter referee grades by role if specified
      const processedKontrolas = kontrolas.map(kontrola => {
        let refereeGrades = kontrola.refereeGrades || [];
        
        console.log(`Processing kontrola ${kontrola._id}: ${refereeGrades.length} referee grades`);
        
        // Log the roles we found
        const rolesInThisKontrola = refereeGrades.map(grade => grade.refereeRole);
        console.log(`Roles in kontrola ${kontrola._id}:`, rolesInThisKontrola);
        
        // Filter by role if specified
        if (role && role !== 'Admin') {
          const originalCount = refereeGrades.length;
          refereeGrades = refereeGrades.filter(grade => grade.refereeRole === role);
          console.log(`Filtered by role ${role}: ${originalCount} -> ${refereeGrades.length} grades`);
        }
        
        return {
          ...kontrola,
          refereeGrades
        };
      }).filter(kontrola => kontrola.refereeGrades && kontrola.refereeGrades.length > 0);
      
      console.log(`✅ Processed ${processedKontrolas.length} kontrola records after filtering`);
      
      // Log sample data for debugging
      if (processedKontrolas.length > 0) {
        const sample = processedKontrolas[0];
        console.log('Sample kontrola structure:', {
          id: sample._id,
          gameInfo: sample.gameId ? {
            homeTeam: sample.gameId.homeTeam,
            awayTeam: sample.gameId.awayTeam,
            date: sample.gameId.date
          } : 'No game info',
          refereeGradesCount: sample.refereeGrades.length,
          sampleGrade: sample.refereeGrades[0] ? {
            refereeName: sample.refereeGrades[0].refereeName,
            refereeRole: sample.refereeGrades[0].refereeRole,
            ocjena: sample.refereeGrades[0].ocjena,
            pogreske: sample.refereeGrades[0].pogreske
          } : 'No grades'
        });
      }
      
      res.json(processedKontrolas);
      
    } catch (error) {
      console.error('❌ Error getting kontrola statistics:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        error: 'Greška pri dohvaćanju statistika kontrola',
        details: error.message
      });
    }
  }
);

module.exports = router;