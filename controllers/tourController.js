const multer = require('multer');
// const sharp = require('sharp'); // image processing lib for node

const Tour = require('./../models/tourModel');
const catchAsync = require('./../utils/catchAsync');
const factory = require('./handlerFactory');
const AppError = require('./../utils/appError');

const multerStorage = multer.memoryStorage(); //the image is stored as a buffer in memory. use in sharp implementation

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

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 }
]); //since we have multiple fields(files). in imageCover we want only 1 img. in images we want 3 imgs

// upload.single('image') produces req.file
// upload.array('images', 5) when we only have 1 field that accepts multiple imgs. 5 is maxCount. fields and array produces req.files

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpg`;
  // 1) Cover image
  /*
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333) //resize(width, height) to crop image
    .toFormat('jpeg') //to convert all images to JPEG
    .jpeg({ quality: 90 }) //set quality of jpeg to 90%
    .toFile(`public/img/tours/${req.body.imageCover}`);

  // 2) Other images
  req.body.images =[];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333) //resize(width, height) to crop image
        .toFormat('jpeg') //to convert all images to JPEG
        .jpeg({ quality: 90 }) //set quality of jpeg to 90%
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    }) // we use map so that we can save the promises of the async cb function and then await them using Promise.all
  );
  */

  next();
});

exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

// exports.deleteTour = catchAsync(async (req, res, next) => {
//   const tour = await Tour.findByIdAndDelete(req.params.id);

//   if (!tour) {
//     return next(new AppError('No tour found with given ID', 404));
//   }

//   res.status(204).json({
//     //204 no content
//     status: 'success',
//     data: null
//   });
// });

exports.getTourStats = catchAsync(async (req, res, next) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingsAverage: { $gte: 4.5 } }
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' }, //specifies what field we want to group by
        numTours: { $sum: 1 }, // for each doc that goes thru this pipel 1 is added to sum
        numRatings: { $sum: '$ratingsQuantity' },
        avgRating: { $avg: '$ratingsAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' }
      } // allows us to group docs together using an accumulator
    },
    {
      $sort: { avgPrice: 1 } //in this we use the same field names we used above
    }
    // {
    //   $match: { _id: { $ne: 'EASY' } }
    // }
  ]); //we pass an array of stages to define the steps to manipulate the data. the docs pass thru these stages one by one in the defined seq

  res.status(200).json({
    status: 'success',
    data: {
      stats
    }
  });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
  const year = req.params.year * 1;

  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates' //it deconstructs an array field from the input docs and outputs a doc for each ele of the array
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`)
        }
      }
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 },
        tours: { $push: '$name' }
      }
    },
    {
      $addFields: { month: '$_id' }
    },
    {
      $project: {
        _id: 0
      }
    },
    {
      $sort: { numTourStarts: -1 }
    },
    {
      $limit: 12
    }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      plan
    }
  });
});

exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;
  // we needs the radius of our sphere in radians. To do this we divide the distance by the radius of the earth

  if (!lat || !lng) {
    return next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng.',
        400
      )
    );
  }

  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } }
  });
  // $geoWithin is a geospatial operator that finds docs within a certain geometry
  // in the above query we define that we want to find docs inside of a sphere that starts at the point we get from user(latlng) and that has a radius of the distance(which we get from user). we do the sphere thing by defining $centerSphere
  // $centerSphere takes in an array of the coordinates and of the radius

  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: {
      data: tours
    }
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');

  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

  if (!lat || !lng) {
    return next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng.',
        400
      )
    );
  }

  const distances = await Tour.aggregate([
    {
      $geoNear: {
        near: {
          //the point from which to calculate distances
          type: 'Point',
          coordinates: [lng * 1, lat * 1]
        }, //geoJson
        distanceField: 'distance', // name of the field that will be created
        distanceMultiplier: multiplier //specify a number that is multiplied with all the distances
      }
    }, //$geoNear is the only geospatial aggregation pipeline stage. Always needs to be 1st in the pipeline. It also requires that atleast one of our fields contains a geospatial index. If there's only one geospatial index then $geoNear automatically uses it to perform the calculation. If we have multiple fields then we need to use the keys param to define the field we want to use
    {
      $project: {
        distance: 1,
        name: 1
      }
    }
  ]);
  res.status(200).json({
    status: 'success',
    data: {
      data: distances
    }
  });
});
