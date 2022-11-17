const { Model, 
        DataTypes: { INTEGER, STRING, DATE, DATEONLY } 
      } = require('sequelize');
const sequelize = require('../sequelize.js');

/* models */
const User = require('./User');
const Course = require('./Course');

class SummaryCourse extends Model {
}

SummaryCourse.init({
    user_id: INTEGER,
    course_id: INTEGER,
    certification_issued_at: DATE,
    certification_accepted_at: DATE
},{
    sequelize,
    modelName: 'summary_courses',
    tableName: 'summary_courses',

    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

SummaryCourse.belongsTo(User, {
    foreignKey: 'user_id'
});

SummaryCourse.belongsTo(Course, {
    foreignKey: 'course_id'
});

module.exports = SummaryCourse;