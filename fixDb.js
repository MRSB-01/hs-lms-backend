const mongoose = require('mongoose');
const MONGODB_URI = "mongodb://127.0.0.1:27017/hs_lms";

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB.");
    const courses = await mongoose.connection.db.collection('courses').find({}).toArray();
    console.log('Total courses:', courses.length);
    let updatedCount = 0;
    
    for (const c of courses) {
      console.log(`Course: ${c.title} | ContentType: ${c.contentType} | isPublished: ${c.isPublished}`);
      
      let newContentType = c.contentType;
      // If undefined or null
      if (!newContentType) {
          newContentType = 'pdf';
          if (c.chapters && c.chapters.length > 0 && c.chapters[0].lectures && c.chapters[0].lectures.length > 0) {
              newContentType = 'video';
          } else if (c.videoUrl || c.totalLectures > 0) {
              newContentType = 'video';
          }
      }
      // Or maybe it's not set correctly despite having chapters?
      // Step 7 says "If video courses have contentType as undefined or null or missing: Write a MongoDB update"
      
      if (!c.contentType) {
          console.log(`Updating missing contentType for ${c.title} to: ${newContentType}`);
          await mongoose.connection.db.collection('courses').updateOne(
              { _id: c._id }, 
              { $set: { contentType: newContentType } }
          );
          updatedCount++;
      }
    }
    console.log(`Finished checking courses. Updated: ${updatedCount}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error connecting to MongoDB:", err);
    process.exit(1);
  });
