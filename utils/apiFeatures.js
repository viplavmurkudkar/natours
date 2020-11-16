class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  filter() {
    // 1A) Filtering
    const queryObj = { ...this.queryString }; //we cannot do queryObj=req.query because the new var will only point to req.query. this does not create a new object. so any change in queryObj will also change req.query
    const excludedFields = ['page', 'sort', 'limit', 'fields'];
    excludedFields.forEach(el => delete queryObj[el]);

    // 1B) Advanced Filtering
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`); //replace also accepts a callback function as its second arg. In that callback funcn we get access to the matched value which we can then replace by returning a val from our callbck func

    // { difficulty: 'easy', duration: { $gte: 5 } }
    // { difficulty: 'easy', duration: { gte: '5' } }

    this.query = this.query.find(JSON.parse(queryStr));

    return this; //returns the entire object which has access to all the functions so we can implement the chaining TourController.getAllTours()
  }

  sort() {
    if (this.queryString.sort) {
      // console.log(this.queryString.sort);
      const sortBy = this.queryString.sort.split(',').join(' '); // replace , by ' '
      this.query = this.query.sort(sortBy);
      // sort('price ratingsAverage') if price is same then sort by 2nd field(ratingsAvg)
    } else {
      this.query = this.query.sort('-createdAt'); // if user does not specify sorting we set a default one, to sort by createdAt field in desc order
    }

    return this; //returns the entire object
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(',').join(' ');
      this.query = this.query.select(fields);
    } else {
      this.query = this.query.select('-__v'); //'__v' field is set and used internally by mongoose. we exclude that here by using '-'. the above query means select all the fields except the '-' one
    }

    return this;
  }

  paginate() {
    const page = this.queryString.page * 1 || 1; //default val of page is 10
    const limit = this.queryString.limit * 1 || 100; //default results per page is 100
    const skip = (page - 1) * limit;

    // page=2 & limit=10, 1-10=>page1 11-20=>page2
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
