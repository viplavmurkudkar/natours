const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review cannot be empty'],
      trim: true
      //   minLength: [20, 'A review must be at least 20 characters'],
      //   maxLength: [500, 'A review must be at most 500 characters']
    },
    rating: {
      type: Number,
      required: [true, 'A review must have a rating'],
      min: [1, 'A review can have a min rating of 1'],
      max: [5, 'A review can have a max rating of 5']
    },
    createdAt: {
      type: Date,
      default: Date.now()
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'A review must belong to a tour.']
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'A review must belong to a user.']
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// To prevent users from writing multiple reviews for one tour(duplicate reviews)
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

reviewSchema.pre(/^find/, function(next) {
  //   this.populate({
  //     path: 'tour',
  //     select: 'name'
  //   }).populate({
  //     path: 'user',
  //     select: 'name photo'
  //   });

  this.populate({
    path: 'user',
    select: 'name photo'
  });

  next();
});

//Static method. We use a static method here because the this keyword points to the current model in a static method. Since we want to use aggregate(which we call on a model).
// We call static method like Review.calcAverageRatings()
reviewSchema.statics.calcAverageRatings = async function(tourId) {
  // Calculate stats of a tour
  const stats = await this.aggregate([
    {
      $match: { tour: tourId }
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' }
      }
    }
  ]);
  // console.log(stats);

  //Update the stats in the tour
  // stats = [ { _id: 5fa0044ed53da79668114b59, nRating: 5, avgRating: 3.8 } ]
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5
    });
  }
};

// to calculate/recalculate tour stats(avg and quantity) whenever new review is added/created
reviewSchema.post('save', function() {
  // 'this' points to current review
  // this.constructor points to the current model i.e Review. So 'this' points to the current document(review) and the constructor is basically the model that created that document.

  this.constructor.calcAverageRatings(this.tour);
}); // post middleware does not get access to next

// findByIdAndUpdate
// findByIdAndDelete
reviewSchema.pre(/^findOneAnd/, async function(next) {
  this.r = await this.findOne(); // this is a query middleware. so this points to current query not document. to get the document we do this. also using this.r gives us access to r in the post middleware below
  // console.log(this.r);
  next();
}); // has to be pre because we do not have access to the query in post since it has already executed.

reviewSchema.post(/^findOneAnd/, async function() {
  // await this.findOne() does NOT work here since query has already executed. Also we need to do this in post because in pre the value of the review has not yet been updated in db. so we get old value
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;
