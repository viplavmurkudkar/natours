class AppError extends Error {
  constructor(message, statusCode) {
    super(message); //message is the only param that the Error class accepts.

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true; //all errs created using this class are operational errs. so this prop is set true for them all. we can then test for this prop and only send err msgs back to the client for operational errs

    Error.captureStackTrace(this, this.constructor); //due to this when a new obj is created and the constructor function is called then that func call will not appear in the stack trace and pollute it
  }
}

module.exports = AppError;
