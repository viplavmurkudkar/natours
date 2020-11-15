const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'A user must have a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'An email must be provided'],
    unique: true,
    lowercase: true,
    validate: [validator.isEmail, 'Please enter a valid email']
  },
  photo: {
    type: String,
    default: 'default.jpg'
  },
  role: {
    type: String,
    enum: ['user', 'guide', 'lead-guide', 'admin'],
    default: 'user'
  },
  password: {
    type: String,
    required: [true, 'A password must be provided'],
    minlength: [8, 'A password must have at least 8 characters'],
    select: false
  },
  passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // This only works on CREATE and SAVE!! Dont use update for anything related to passwords
      validator: function(val) {
        return this.password === val; //if we return false we get ValidationError
      },
      message: 'The two passwords provided do not match'
    }
    //select: false
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  active: {
    type: Boolean,
    default: true,
    select: false
  }
});

userSchema.pre('save', async function(next) {
  // Only run this function if password was actually modified
  if (!this.isModified('password')) return next();

  // Hash the password with cost 12
  this.password = await bcrypt.hash(this.password, 12); // 12 is the cost param. it is the measure of how CPU intensive this op will be. the higher the cost the better the password is encrypted but the process also takes longer the higher the cost

  //Delete passwordConfirm field
  this.passwordConfirm = undefined; // delete the field/ wont be persisted in db
  next();
});

userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return next();

  this.passwordChangedAt = Date.now() - 1000; // saving to db may take a bit of time sometimes. so the passwordChangedAt property could have a time greater than the time at which the JWT token was issued. Due to this the user cannot login using the new token.. so we substract 1 s from Date.now() to prevent that.
  next();
});

userSchema.pre(/^find/, function(next) {
  // this points to current query
  this.find({ active: { $ne: false } });
  next();
});

// Instance method. its a method that is available on all docs of a collection. In a instance method 'this' always points to the current document
userSchema.methods.correctPassword = async function(
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
}; // since password is set to select: false we cannot do this.password here

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    ); //.getTime() gives us the time in ms while JWTTimestamp is in secs. so we divide by 1000 to convert it to seconds

    console.log(changedTimestamp, JWTTimestamp);
    return JWTTimestamp < changedTimestamp; // the day or time the token was issued should be greater than the changedTimestamp. say the token was issued at time 100. but then we changed the password at time 200. so we changed passwd after token was issued and thus 100<200 is now true. so we return true. true means changed
  }

  //false means NOT Changed
  return false;
};

userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex'); //we send this token to the user. its like a reset password that the user can use to create a new real password. we should never store a plain reset token in the database

  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  console.log({ resetToken }, this.passwordResetToken);

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken; // we send this via email to the user. it doesnt make sense to encrypt it because if the token in the db was the exact same that we could use to actually change the password then there wouldnt be any encryption at all
};

const User = mongoose.model('User', userSchema);

module.exports = User;
