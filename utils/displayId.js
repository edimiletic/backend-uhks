const Counter = require('../models/Counter');

async function nextDisplayId(key) {
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return doc.seq;
}

function withDisplayId(schema, counterKey) {
  schema.add({
    displayId: {
      type: Number,
      unique: true,
      sparse: true
    }
  });

  schema.pre('save', async function (next) {
    if (this.displayId != null) {
      return next();
    }
    try {
      this.displayId = await nextDisplayId(counterKey);
      next();
    } catch (err) {
      next(err);
    }
  });
}

async function backfillDisplayIds(Model, counterKey) {
  const maxDoc = await Model.findOne({ displayId: { $ne: null } })
    .sort({ displayId: -1 })
    .select('displayId')
    .lean();

  if (maxDoc && maxDoc.displayId) {
    await Counter.findByIdAndUpdate(
      counterKey,
      { $max: { seq: maxDoc.displayId } },
      { upsert: true }
    );
  }

  const docs = await Model.find({
    $or: [{ displayId: { $exists: false } }, { displayId: null }]
  })
    .sort({ createdAt: 1, _id: 1 })
    .select('_id')
    .lean();

  for (const doc of docs) {
    await Model.updateOne(
      { _id: doc._id },
      { $set: { displayId: await nextDisplayId(counterKey) } }
    );
  }

  if (docs.length) {
    console.log(`✅ displayId backfill ${Model.modelName}: ${docs.length}`);
  }
}

module.exports = { nextDisplayId, withDisplayId, backfillDisplayIds };
