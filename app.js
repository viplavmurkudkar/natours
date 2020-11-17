const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression'); //to compress all the resps(html or json) that we send to client
const cors = require('cors');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reviewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

// Start express app
const app = express();

app.enable('trust proxy'); //to trust proxys (for secure option in authController.createSendToken)

//PUG engine setup
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views')); // describe loc of our views folder

// 1) GLOBAL MIDDLEWARES (function that can modify the incoming request data)

//Implement CORS
app.use(cors()); //Sets Access-Control-Allow-Origin header to *. will only work for simple reqs(get and post)
// api.natours.com (Api url) while front end is natours.com to then allow natours.com to access api.natours.com we do
// app.use(
//   cors({
//     origin: 'https://www.natours.com'
//   })
// );

app.options('*', cors()); //options is another http method like get, post
// app.options('/api/v1/tours/:id', cors());

// Serving static files
// app.use(express.static(`${__dirname}/public`));
app.use(express.static(path.join(__dirname, 'public'))); //to serve static files like overview.html or tours.html or favicon.png or style.css

// Set Security HTTP headers
app.use(helmet());

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting to prevent dos and brute force attacks
const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 60 * 1000,
  message: 'Too many requests from this IP, please try again in an hour'
}); // in the above object we defined that we want max of 100 reqs from one single IP in a hr. If that limit is crossed by an IP theyll get back an error.
app.use('/api', limiter);

// Body parser, reading data from body into req.body
app.use(express.json({ limit: '10kb' })); // This middleware reads the data from the request body into req.body limit: limits body size to 10kb
app.use(express.urlencoded({ extended: true, limit: '10kb' })); // for parsing data coming from a form(updating user data without using our api)
app.use(cookieParser());

// Data sanitization against NoSQL query injection.
app.use(mongoSanitize()); // looks at the req body, req query string and req params and filters out '$' and '.' signs(since thats how mongo operators are written)

// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution(like sending 2 sort fields)
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price'
    ]
  }) // with whitelist we allow duplicates for certain fields/params in query string
);

// app.use((req, res, next) => {
//   console.log('Hello from the middleware');
//   next(); // if we dont call next() here then the req resp cycle would be stuck here and we couldnt send back a resp to the client.
// }); // creating our own middleware. This middleware applies to each request since we didnt specify route here.

app.use(compression());

// Test middleware
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  // console.log(req.cookies);
  next();
});

// app.get('/', (req, res) => {
//   res
//     .status(200)
//     .json({ message: 'Hello from the server side!!', app: 'Natours' }); //automatically sets content-type to application/json
// });

// app.post('/', (req, res) => {
//   res.send('You can post to this endpoint...');
// });

// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/dev-data/data/tours-simple.json`)
// );

//2 ROUTE HANDLERS

// const getAllTours = (req, res) => {
//   console.log(req.requestTime);
//   res.status(200).json({
//     status: 'success',
//     requestedAt: req.requestTime,
//     results: tours.length,
//     data: {
//       tours,
//     },
//   });
// };

// const getTour = (req, res) => {
//   console.log(req.params);

//   const id = req.params.id * 1; // multiplying string with number gives a number
//   const tour = tours.find((el) => el.id === id);

//   // if (id > tours.length) {
//   if (!tour) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID',
//     });
//   }

//   res.status(200).json({
//     status: 'success',
//     data: {
//       tour,
//     },
//   });
// };

// const createTour = (req, res) => {
//   // console.log(req.body);

//   const newId = tours[tours.length - 1].id + 1;
//   const newTour = Object.assign({ id: newId }, req.body); // allows us to create new object by merging 2 objs

//   tours.push(newTour);

//   fs.writeFile(
//     `${__dirname}/dev-data/data/tours-simple.json`,
//     JSON.stringify(tours),
//     (err) => {
//       res.status(201).json({
//         status: 'success',
//         data: {
//           tour: newTour,
//         },
//       });
//     }
//   );
// };

// const updateTour = (req, res) => {
//   if (parseInt(req.params.id) > tours.length) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID',
//     });
//   }
//   res.status(200).json({
//     status: 'success',
//     data: {
//       tour: '<Updated tour here>',
//     },
//   });
// };

// const deleteTour = (req, res) => {
//   if (parseInt(req.params.id) > tours.length) {
//     return res.status(404).json({
//       status: 'fail',
//       message: 'Invalid ID',
//     });
//   }
//   res.status(204).json({
//     //204 no content
//     status: 'success',
//     data: null,
//   });
// };

// const getAllUsers = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'Route not yet implemented!',
//   });
// };

// const createUser = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'Route not yet implemented!',
//   });
// };

// const getUser = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'Route not yet implemented!',
//   });
// };

// const updateUser = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'Route not yet implemented!',
//   });
// };

// const deleteUser = (req, res) => {
//   res.status(500).json({
//     status: 'error',
//     message: 'Route not yet implemented!',
//   });
// };

// app.get('/api/v1/tours', getAllTours);
// app.get('/api/v1/tours/:id', getTour);
// app.post('/api/v1/tours', createTour);
// app.patch('/api/v1/tours/:id', updateTour);
// app.delete('/api/v1/tours/:id', deleteTour);

// 3) ROUTES

// const tourRouter = express.Router(); // middleware
// const userRouter = express.Router();

// tourRouter.route('/').get(getAllTours).post(createTour);

// tourRouter.route('/:id').get(getTour).patch(updateTour).delete(deleteTour);

// userRouter.route('/').get(getAllUsers).post(createUser);

// userRouter.route('/:id').get(getUser).patch(updateUser).delete(deleteUser);

app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter); // we want to use the middleware tourRouter on the route
app.use('/api/v1/users', userRouter); // '/api/v1/users' or '/api/v1/users'. the middleware will only run on the specified route/path. This is called mounting the routers
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

// 4) START THE SERVER
// const port = 3000;
// app.listen(port, () => {
//   console.log(`App running on port ${port}`);
// });

// app.all('*') catches all http methods and * stands for all url
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404)); //whatever we pass into next() is assumed to be an error by express. it skips all the next middlewares and passes the error to our global error handler middleware
}); //middlewares are executed in the order in which they appear in code. so if a req reaches this middleware, it hasnt been caught by any of the routers. so we dont have a route implemented for it.

app.use(globalErrorHandler);

module.exports = app;
