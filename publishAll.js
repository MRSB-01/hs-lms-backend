const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/hs_lms')
  .then(async () => {
    const res = await mongoose.connection.db.collection('courses').updateMany({}, { $set: { isPublished: true } });
    console.log(`Updated ${res.modifiedCount} courses to be published.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
