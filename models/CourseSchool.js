const { Model, 
        DataTypes: { INTEGER } 
       } = require('sequelize');

const sequelize = require('../sequelize.js');

/*models*/
const School = require('./School');
const Course = require('./Course');

class CourseSchool extends Model {
}

CourseSchool.init({
    school_id: INTEGER,
    course_id: {
        type: INTEGER,
        primaryKey: true
    }
},{
    sequelize,
    modelName: 'course_school',
    tableName: 'course_school',

    timestamps: false
});

CourseSchool.belongsTo(School,{
    foreignKey: 'school_id'
});

module.exports = CourseSchool;