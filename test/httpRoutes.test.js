const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const BasketballGame = require('../models/BasketballGames');
const TravelExpense = require('../models/TravelExpense');
const { Exam } = require('../models/Exams');
const JWT_SECRET = require('../config/jwt');
const { COOKIE_NAME } = require('../utils/sessionCookie');
const { getGamesVisibilityFilter } = require('../config/roles');

const authRoutes = require('../routes/auth');
const basketballGameRoutes = require('../routes/basketballGames');
const examRoutes = require('../routes/exams');
const travelExpenseRoutes = require('../routes/travelExpense');

const original = {
  userFindById: User.findById,
  userFindOne: User.findOne,
  gameFind: BasketballGame.find,
  gameFindById: BasketballGame.findById,
  examFindById: Exam.findById,
  examFindOne: Exam.findOne,
  expenseFindById: TravelExpense.findById,
  expenseFind: TravelExpense.find,
  expenseCount: TravelExpense.countDocuments
};

const usersById = new Map();
const usersByName = new Map();
let lastGameFindQuery = null;
let passwordHash = '';

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api', authRoutes);
  instance.use('/api/basketball-games', basketballGameRoutes);
  instance.use('/api/exams', examRoutes);
  instance.use('/api/travel-expense', travelExpenseRoutes);
  return instance;
}

function makeUser({ username, roles }) {
  const _id = new mongoose.Types.ObjectId();
  const user = {
    _id,
    username,
    name: username,
    surname: 'Test',
    password: passwordHash,
    tokenVersion: 0,
    roles,
    toObject() {
      const copy = { ...this };
      delete copy.password;
      delete copy.toObject;
      return copy;
    }
  };
  usersById.set(String(_id), user);
  usersByName.set(username, user);
  return user;
}

function sessionCookie(user) {
  const token = jwt.sign(
    { id: user._id, username: user.username, role: user.roles[0].name, v: user.tokenVersion || 0 },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  return `${COOKIE_NAME}=${token}`;
}

async function request(url, path, { method = 'GET', user, json, headers = {} } = {}) {
  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      Connection: 'close',
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      ...(user ? { Cookie: sessionCookie(user) } : {}),
      ...headers
    },
    body: json ? JSON.stringify(json) : undefined
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, headers: response.headers };
}

function stubModels() {
  User.findById = (id) => {
    const found = usersById.get(String(id)) || null;
    const promise = Promise.resolve(found);
    promise.select = () => promise;
    return promise;
  };
  User.findOne = async (query) => usersByName.get(query?.username) || null;
  BasketballGame.find = (query) => {
    lastGameFindQuery = query;
    const result = Promise.resolve([]);
    result.select = () => result;
    result.lean = async () => [{ homeTeam: 'A', awayTeam: 'B' }];
    return result;
  };
  BasketballGame.findById = async () => null;
  Exam.findById = async () => null;
  Exam.findOne = async () => null;
  TravelExpense.findById = () => ({
    populate: async () => null
  });
  TravelExpense.countDocuments = async () => 0;
  TravelExpense.find = () => expenseQuery([]);
}

function expenseQuery(docs) {
  const query = {
    populate() {
      return query;
    },
    sort() {
      return query;
    },
    skip() {
      return query;
    },
    limit() {
      return query;
    },
    then(resolve, reject) {
      return Promise.resolve(docs).then(resolve, reject);
    }
  };
  return query;
}

describe('httpRoutes', { concurrency: 1 }, () => {
  let referee;
  let otherReferee;
  let commissioner;
  let admin;
  let server;
  let url;

  before(async () => {
    passwordHash = await bcrypt.hash('tajna-lozinka', 4);
    referee = makeUser({
      username: 'http-sudac',
      roles: [{ name: 'Sudac', competitions: [] }]
    });
    otherReferee = makeUser({
      username: 'http-sudac-2',
      roles: [{ name: 'Sudac', competitions: [] }]
    });
    commissioner = makeUser({
      username: 'http-psluz',
      roles: [{ name: 'Povjerenik za službene osobe', competitions: [] }]
    });
    admin = makeUser({
      username: 'http-admin',
      roles: [{ name: 'Admin', competitions: [] }]
    });
    stubModels();
    const listening = await listen(app());
    server = listening.server;
    url = listening.url;
  });

  afterEach(() => {
    stubModels();
  });

  after(async () => {
    User.findById = original.userFindById;
    User.findOne = original.userFindOne;
    BasketballGame.find = original.gameFind;
    BasketballGame.findById = original.gameFindById;
    Exam.findById = original.examFindById;
    Exam.findOne = original.examFindOne;
    TravelExpense.findById = original.expenseFindById;
    TravelExpense.find = original.expenseFind;
    TravelExpense.countDocuments = original.expenseCount;
    await close(server);
  });

  it('login 401 isti tekst, 200 stavlja kolačić bez lozinke', async () => {
    const failed = await request(url, '/api/login', {
      method: 'POST',
      json: { username: 'http-sudac', password: 'krivo' }
    });
    assert.equal(failed.status, 401);
    assert.equal(failed.body.error, 'Neispravno korisničko ime ili lozinka');

    const ok = await request(url, '/api/login', {
      method: 'POST',
      json: { username: 'http-sudac', password: 'tajna-lozinka' }
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.password, undefined);
    assert.match(String(ok.headers.get('set-cookie') || ''), /uhks_session=/);
  });

  it('Bearer ne ulazi, kolačić da', async () => {
    const token = jwt.sign({ id: referee._id, v: 0 }, JWT_SECRET, { expiresIn: '1h' });
    const bearer = await request(url, '/api/me', {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.equal(bearer.status, 401);

    const cookie = await request(url, '/api/me', { user: referee });
    assert.equal(cookie.status, 200);
    assert.equal(cookie.body.username, 'http-sudac');
  });

  it('raspored dana gleda visibility filter suca', async () => {
    const date = '2026-12-01';
    const result = await request(url, `/api/basketball-games/schedule/${date}`, { user: referee });
    assert.equal(result.status, 200);
    assert.ok(lastGameFindQuery.$and);
    assert.deepEqual(lastGameFindQuery.$and[1], getGamesVisibilityFilter(referee));
  });

  it('tuđi kalendar suca je 403, vlastiti i povjerenik prolaze', async () => {
    const date = '2026-12-01';
    const denied = await request(
      url,
      `/api/basketball-games/referee/${otherReferee._id}/date/${date}`,
      { user: referee }
    );
    assert.equal(denied.status, 403);

    const own = await request(
      url,
      `/api/basketball-games/referee/${referee._id}/date/${date}`,
      { user: referee }
    );
    assert.equal(own.status, 200);

    const asCommissioner = await request(
      url,
      `/api/basketball-games/referee/${referee._id}/date/${date}`,
      { user: commissioner }
    );
    assert.equal(asCommissioner.status, 200);
  });

  it('sudac ne nominira, povjerenik ne nominira sam sebe', async () => {
    const gameId = new mongoose.Types.ObjectId();
    const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    BasketballGame.findById = async () => ({
      _id: gameId,
      date: future,
      time: '20:00',
      competition: 'PRVA MUŠKA LIGA',
      refereeAssignments: []
    });

    const asReferee = await request(url, `/api/basketball-games/${gameId}/assign-referee`, {
      method: 'POST',
      user: referee,
      json: { userId: String(otherReferee._id), role: 'Sudac' }
    });
    assert.equal(asReferee.status, 403);

    const self = await request(url, `/api/basketball-games/${gameId}/assign-referee`, {
      method: 'POST',
      user: commissioner,
      json: { userId: String(commissioner._id), role: 'Sudac' }
    });
    assert.equal(self.status, 400);
    assert.match(self.body.error, /sami sebe/);
  });

  it('GET ispita tuđeg je 403, svoj ne šalje točan odgovor', async () => {
    const examId = new mongoose.Types.ObjectId();
    const exam = {
      _id: examId,
      userId: referee._id,
      isCompleted: false,
      expiresAt: new Date(Date.now() + 60_000),
      questions: [
        { _id: new mongoose.Types.ObjectId(), questionText: 'Je li loptom?', correctAnswer: true }
      ],
      toObject() {
        return {
          _id: this._id,
          userId: this.userId,
          questions: this.questions
        };
      }
    };
    Exam.findById = async () => exam;

    const stolen = await request(url, `/api/exams/${examId}`, { user: otherReferee });
    assert.equal(stolen.status, 403);

    const own = await request(url, `/api/exams/${examId}`, { user: referee });
    assert.equal(own.status, 200);
    assert.equal(own.body.questions[0].questionText, 'Je li loptom?');
    assert.equal(own.body.questions[0].correctAnswer, undefined);
  });

  it('generate postojećeg ispita također skida točan odgovor', async () => {
    Exam.findOne = async () => ({
      _id: new mongoose.Types.ObjectId(),
      userId: referee._id,
      questions: [{ _id: new mongoose.Types.ObjectId(), questionText: 'Faul?', correctAnswer: false }],
      toObject() {
        return { _id: this._id, questions: this.questions };
      }
    });
    const result = await request(url, '/api/exams/generate', { method: 'POST', user: referee });
    assert.equal(result.status, 200);
    assert.equal(result.body.questions[0].correctAnswer, undefined);
  });

  it('tuđi putni nalog se ne preuzima, bez sesije 401', async () => {
    const expenseId = new mongoose.Types.ObjectId();
    TravelExpense.findById = () => ({
      populate: async () => ({
        _id: expenseId,
        userId: referee._id,
        gameId: { competition: 'PRVA MUŠKA LIGA' },
        nalogFile: { originalName: 'nalog.pdf', fileId: new mongoose.Types.ObjectId() }
      })
    });

    const anon = await request(url, `/api/travel-expense/${expenseId}/files/nalog`);
    assert.equal(anon.status, 401);

    const stolen = await request(url, `/api/travel-expense/${expenseId}/files/nalog`, {
      user: otherReferee
    });
    assert.equal(stolen.status, 403);
  });

  it('liste putnih naloga su stranice, limit ne može biti veći od 100', async () => {
    const own = { _id: new mongoose.Types.ObjectId(), userId: referee._id, state: 'Predano' };
    TravelExpense.countDocuments = async () => 1;
    TravelExpense.find = () => expenseQuery([own]);

    const mine = await request(url, '/api/travel-expense/my?page=1&limit=9999', { user: referee });
    assert.equal(mine.status, 200);
    assert.equal(mine.body.expenses.length, 1);
    assert.equal(mine.body.total, 1);
    assert.equal(mine.body.currentPage, 1);

    const forbidden = await request(url, '/api/travel-expense', { user: referee });
    assert.equal(forbidden.status, 403);

    const listed = await request(url, '/api/travel-expense?limit=20', { user: admin });
    assert.equal(listed.status, 200);
    assert.ok(Array.isArray(listed.body.expenses));
    assert.equal(listed.body.total, 1);
  });
});
