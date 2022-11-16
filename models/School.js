const { Model, 
        DataTypes: { STRING, BOOLEAN } 
      } = require('sequelize');
const sequelize = require('../sequelize.js');

/* models */
const SchoolWorkspace = require('./SchoolWorkspace');

class Schools extends Model {
}

Schools.init({
    name: STRING,
    active: BOOLEAN
},{
    sequelize,
    modelName: 'schools',
    tableName: 'schools',

    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

Schools.hasOne(SchoolWorkspace, {
    foreignKey: 'school_id'
});

module.exports = Schools;