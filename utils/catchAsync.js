module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next); // = catch(err => next(err)) next in the catch callback is automatically called with the param that the callback receives
  };
}; //the fn funcn is an async funcn and so it returns a promise which if rejected we can catch as done above
// in order to get rid of our try/catch blocks we wrap or async func( getAllTours, createTour etc ) inside of the catchAsync funcn. catchAsync returns a new anon function which is then assigned to createTour etc.
