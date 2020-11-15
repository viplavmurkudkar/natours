const multer = require('multer');
// const sharp = require('sharp'); // image processing lib for node

const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const factory = require('./handlerFactory');

// file is actually req.file. its value is
// {
//   fieldname: 'photo',
//   originalname: 'leo.jpg',
//   encoding: '7bit',
//   mimetype: 'image/jpeg',
//   destination: 'public/img/users',
//   filename: 'user-5c8a1f292f8fb814b56fa184-1605169087033.jpeg',
//   path: 'public\\img\\users\\user-5c8a1f292f8fb814b56fa184-1605169087033.jpeg',
//   size: 207078
// }

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    //destination is callback func(cb is also callback func)
    cb(null, 'public/img/users'); // similar to next(). 1st arg is error. 2nd arg is the act dest
  },
  filename: (req, file, cb) => {
    // new filename = user-67236792avda-33322137863.jpeg ie user-{userId}-{currentTimeStamp}.jpeg
    const ext = file.mimetype.split('/')[1];
    cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
  }
});
//const multerStorage = multer.memoryStorage(); //the image is stored as a buffer in memory. use in sharp implementation

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please only upload images.', 400), false);
  }
}; // to test if uploaded file is an image. if it is then we pass true into cb. else pass false along with error

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter
}); //configuring a multer upload

exports.uploadUserPhoto = upload.single('photo'); // upload.single bcoz we only want to update one img. into single() we pass name of the field in the form concerned with uploading the img. also responsible for adding req.file to req obj

exports.resizeUserPhoto = catchAsync(async (req, res, next) => {
  if (!req.file) return next();
  req.file.filename = `user-${req.user.id}-${Date.now()}.jpeg`;
  /*
  await sharp(req.file.buffer)
    .resize(500, 500) //resize(width, height) to crop image
    .toFormat('jpeg') //to convert all images to JPEG
    .jpeg({quality: 90}) //set quality of jpeg to 90%
    .toFile(`public/img/users/${req.file.filename}`)
  */
  next();
}); //to convert images into squares and also compress them

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach(el => {
    if (allowedFields.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
}; // Objects.keys(obj) returns an array filled with all the field names of obj

exports.getMe = (req, res, next) => {
  req.params.id = req.user.id;
  next();
};

exports.updateMe = catchAsync(async (req, res, next) => {
  // 1) Create error if user POSTs password data fails
  if (req.body.password || req.body.passwordConfirm) {
    return next(
      new AppError(
        'This route is not for password updates. Please use /updateMyPassword',
        400
      )
    );
  }

  // 2) Filter out unwanted field names that are not allowed to be updated
  const filteredBody = filterObj(req.body, 'name', 'email');
  if (req.file) filteredBody.photo = req.file.filename;

  // 2) Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user._id, filteredBody, {
    new: true,
    runValidators: true
  }); // we use findByIdAndUpdate here bcoz we're not dealing with passwords

  res.status(200).json({
    status: 'success',
    data: {
      user: updatedUser
    }
  });
});

exports.deleteMe = catchAsync(async (req, res, next) => {
  await User.findByIdAndUpdate(req.user.id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.createUser = (req, res) => {
  res.status(500).json({
    status: 'error',
    message: 'This route is not defined! Pleas use /signup instead'
  });
};

exports.getAllUsers = factory.getAll(User);
exports.getUser = factory.getOne(User);
// DO NOT update passwords with this
exports.updateUser = factory.updateOne(User); // only for admins and not for passwords
exports.deleteUser = factory.deleteOne(User); // only for admins. User will use deleteMe
