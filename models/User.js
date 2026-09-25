const mongoose = require('mongoose');
const {
  USER_ROLES,
  ALL_COMPETITIONS,
  REFEREE_RANKS,
  normalizeRoleAssignments,
  pickPrimaryRole
} = require('../config/roles');

const roleAssignmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    enum: USER_ROLES,
    trim: true
  },
  competitions: [{
    type: String,
    enum: ALL_COMPETITIONS
  }]
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  surname: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  birthdate: {
    type: Date,
    required: true
  },
  personalCode: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  address: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true,
    enum: USER_ROLES,
    trim: true
  },
  roles: {
    type: [roleAssignmentSchema],
    default: []
  },
  rang: {
    type: String,
    default: '',
    trim: true,
    validate: {
      validator: (value) => !value || REFEREE_RANKS.includes(value),
      message: 'Invalid referee rank'
    }
  },
  najvisaLiga: {
    type: String,
    default: '',
    trim: true,
    validate: {
      validator: (value) => !value || ALL_COMPETITIONS.includes(value),
      message: 'Invalid najvisa liga'
    }
  }
}, {
  timestamps: true
});

userSchema.pre('validate', function syncRoles() {
  const assignments = normalizeRoleAssignments(this);
  this.roles = assignments;
  this.role = pickPrimaryRole(assignments);
});

const serializeUser = (ret) => {
  const assignments = normalizeRoleAssignments(ret);
  ret.roles = assignments;
  ret.role = ret.role || pickPrimaryRole(assignments);
  return ret;
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    return serializeUser(ret);
  }
});

userSchema.set('toObject', {
  transform: (_doc, ret) => serializeUser(ret)
});

const User = mongoose.model('User', userSchema);

module.exports = User;
