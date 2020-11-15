const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const Tour = require('../models/tourModel');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');
const factory = require('./handlerFactory');

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  // 1) Get the currently booked tour
  const tour = await Tour.findById(req.params.tourID);

  // 2) Create checkout session
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    success_url: `${req.protocol}://${req.get('host')}/?tour=${
      req.params.tourID
    }&user=${req.user.id}&price=${tour.price}`, //url that is called as soon as card is successfully charged
    cancel_url: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`, //url where user is redirected if he cancels his current payment
    customer_email: req.user.email,
    client_reference_id: req.params.tourID, //allows us to pass in data abt session we are creating. Once the purchase completes we get access to session obj again. By then we want to create new booking in our db. to do this we need tourID, userId(already have email) and price.
    line_items: [
      {
        name: `${tour.name} Tour`,
        description: tour.summary,
        images: [`http://www.natours.dev/img/tours/${tour.imageCover}`], //need to be live imgs(imgs hosted on the internet)
        amount: tour.price * 100, //need amount in cents
        currency: 'usd',
        quantity: 1
      }
    ] //to specify some details abt the prod itself
  });

  // 3) Send session as response
  res.status(200).json({
    status: 'success',
    session
  });
});

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // This is only TEMPORARY, because its UNSECURE: everyone can make bookings without paying
  const { tour, user, price } = req.query;

  if (!tour || !user || !price) return next();

  await Booking.create({ tour, user, price });

  res.redirect(req.originalUrl.split('?')[0]); // we redirect to the url without the query string since that contains sensitive information
});

exports.getAllBookings = factory.getAll(Booking);
exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
