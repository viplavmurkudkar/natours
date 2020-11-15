const mongoose = require('mongoose');
const slugify = require('slugify');
// const User = require('./userModel');
//const validator = require('validator');

const tourSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'A tour must have a name'], // an error message for when name not present
      unique: true,
      trim: true,
      maxlength: [40, 'A tour name must have less than 40 characters'],
      minlength: [10, 'A tour name must have more than 10 characters']
      //validate: [validator.isAlpha, 'Tour name must only contain characters'] // we dont call the function in validate
    }, // schema type options
    slug: String,
    duration: {
      type: Number,
      required: [true, 'A tour must have a duration']
    },
    maxGroupSize: {
      type: Number,
      required: [true, 'A tour must have a group size']
    },
    difficulty: {
      type: String,
      required: [true, 'A tour must have a difficulty'],
      enum: {
        values: ['easy', 'medium', 'difficult'],
        message: 'Difficulty is either easy or medium or difficult'
      }
    },
    ratingsAverage: {
      type: Number,
      default: 4.5,
      min: [1, 'Rating must be above 1.0'],
      max: [5, 'Rating must be below 5.0'],
      set: val => Math.round(val * 10) / 10 // 4.66667, 46.6667, 47, 4.7
      // set will run each time a new value is set for this field
    },
    ratingsQuantity: {
      type: Number,
      default: 0
    },
    price: {
      type: Number,
      required: [true, 'A tour must have a price'] // called a validator
    },
    priceDiscount: {
      type: Number,
      validate: {
        validator: function(val) {
          // this only points to current doc on NEW document creation and not on update
          return val < this.price; // validator should return either true or false
        }, // this var points to current doc in validate callback funcn. we also have access to the priceDiscount value in callback function.
        message: 'Discount price ({VALUE}) should be below regular price'
      }
    },
    summary: {
      type: String,
      trim: true, //only works for strings. Removes whitespace from the beginning and end of string
      required: [true, 'A tour must have a summary']
    },
    description: {
      type: String,
      trim: true
    },
    imageCover: {
      type: String, //name of img which we will get from file system
      required: [true, 'A tour must have a cover image']
    },
    images: [String],
    createdAt: {
      type: Date,
      default: Date.now(), //returns timestamp in ms. Converted to normal date in mongo
      select: false //will hide this fields from client whenever get request is made
    },
    startDates: [Date],
    secretTour: {
      type: Boolean,
      default: false
    },
    startLocation: {
      //GeoJSON
      type: {
        type: String,
        default: 'Point',
        enum: ['Point']
      }, // schema type opts
      coordinates: [Number], //longitude first followed by latitude
      address: String,
      description: String
    }, //this obj is not for schema type opts. its an embedded obj. we need type and coordinates property for this obj to be recognized as GeoJSON
    locations: [
      {
        type: {
          type: String,
          default: 'Point',
          enum: ['Point']
        },
        coordinates: [Number],
        address: String,
        description: String,
        day: Number
      }
    ], //creating embedded docs. always use array for embedded docs
    //guides: Array
    guides: [
      {
        type: mongoose.Schema.ObjectId, //we expect the type of every element to be MongoDB ID
        ref: 'User' //establishing references btw diff datasets in mongoose
      }
    ] // Child referencing. We connect tours and users(guides) by referencing. When we query the tour, we automatically get access to the tour guides without them being actually saved on tour doc itself
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Single field index
// tourSchema.index({ price: 1 }); // 1 means we're sorting the index in an ascending order. -1 means descending order

// Compound index
tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' }); //for geolocation queries. we basically say that the startLocation should be indexed to a 2d sphere since the data describes real points on a sphere(earth).
//we could also use a 2d index if we're using fictional points on a 2d plane

tourSchema.virtual('durationWeeks').get(function() {
  return this.duration / 7; // this points to current document
}); //this virtual prop will be created each time we get data from the db hence .get()
//we used a reg funcn above because an arrow function does not get its own this keyword. when we want to use this, we use a normal function.

// Virtual populate
tourSchema.virtual('reviews', {
  ref: 'Review',
  foreignField: 'tour', //name of the field in the Review model where the reference to the current model is stored
  localField: '_id'
});

//DOCUMENT MIDDLEWARE: runs b4 .save() and .create() but not .insertMany()
tourSchema.pre('save', function(next) {
  this.slug = slugify(this.name, { lower: true });
  next();
}); //pre middleware. this keyword points to currently processed document. this is called pre save hook

// Implementation of embedding tour guides(users) in the Tour document. This is just an example. for the actual app we use referencing bcoz if we ever have to update an user(change his role or email) we will then have to update the tour document too every time. Below code only works for creating new tour docs and not for updating user docs
// tourSchema.pre('save', async function(next) {
//   const guidesPromises = this.guides.map(async id => await User.findById(id)); // User.findById will return promises and so guidesPromises is an array of promises

//   this.guides = await Promise.all(guidesPromises); //override the array of ids provided by the tour creator, with actual users corresponding to those IDs
//   next();
// });

// tourSchema.pre('save', function(next) {
//   console.log('Will save doc....');
//   next();
// });

// tourSchema.post('save', function(doc, next) {
//   console.log(doc);
//   next();
// }); //call function has access to the doc that was just saved to db. post middlewares are executed after all the pre have executed.

// QUERY MIDDLEWARE (this points to current query)

// tourSchema.pre('find', function(next) {
tourSchema.pre(/^find/, function(next) {
  //all strings that start with find
  this.find({ secretTour: { $ne: true } }); // this keyword points to the current query so we chain another find method on it which filters all the tours for which secretTour is true
  this.start = Date.now();
  next();
});

tourSchema.pre(/^find/, function(next) {
  this.populate({
    path: 'guides',
    select: '-__v -passwordChangedAt'
  }); //populate replaces the fields we referenced in Tour(guides) with the actual data from User (only in query not actual db)

  next();
});

tourSchema.post(/^find/, function(docs, next) {
  console.log(`Query took ${Date.now() - this.start} milliseconds`);
  next();
}); //we get access to all the docs that were returned by the query in post middleware

// AGGREGATION MIDDLEWARE

// tourSchema.pre('aggregate', function(next) {
//   this.pipeline().unshift({ $match: { secretTour: { $ne: true } } }); // to add a new match obj at the beginning of the pipeline array
//   console.log(this.pipeline());
//   next();
// }); //commented because in tourController.getDistances we need geoNear to be the first field in aggregation pipeline. due to this middleware the first stage will always be a match stage

const Tour = mongoose.model('Tour', tourSchema); // convention to have Model name begin with uppercase

module.exports = Tour;
