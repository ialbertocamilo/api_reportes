const { Model, 
        DataTypes: { INTEGER, STRING, BOOLEAN } 
       } = require('sequelize');

const sequelize = require('../sequelize.js');

/* models */
const CourseSchool = require('./CourseSchool');
const Taxonomie = require('./Taxonomie'); 

class Course extends Model {
}

Course.init({
    name: STRING,
    active: BOOLEAN,
    type_id: INTEGER
},{
    sequelize,
    modelName: 'courses',
    tableName: 'courses',

    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Course.hasOne(CourseSchool, {
    foreignKey: 'course_id'
});

Course.belongsTo(Taxonomie, {
    foreignKey: 'type_id'
});

module.exports = Course;