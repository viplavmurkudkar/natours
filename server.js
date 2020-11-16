const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', err => {
  console.log('UNCAUGHT EXCEPTION! Shutting down');
  console.log(err.name, err.message);
  process.exit(1); //absolutely necessary in uncaughtException. Because entire node process is in unclean state. optional in unhandledRejection
});

dotenv.config({ path: './config.env' }); // should be before we require app
const app = require('./app');

const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
  })
  .then(() => console.log('DB connection successful'));

//console.log(process.env);
const port = process.env.PORT || 3000; // absolutely mandatory to specify process.env.PORT for heroku
const server = app.listen(port, () => {
  console.log(`App running on port ${port}`);
});

process.on('unhandledRejection', err => {
  console.log('UNHANDLED REJECTION! Shutting down');
  console.log(err.stack);
  console.log(err.name, err.message);
  server.close(() => {
    //server.close() gives server time to finish all reqs still pending.
    process.exit(1); // to shut down app. 0 stands for success, 1 for uncaught exceptions
  });
}); // any promise rejection that we might not have caught in our app will be handled here. final safety net
