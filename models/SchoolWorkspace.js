const { Model, 
        DataTypes: { INTEGER } 
      } = require('sequelize');
const sequelize = require('../sequelize.js');

/* models */
const School = require ('./School'); 

class SchoolWorkspace extends Model {
}

SchoolWorkspace.init({
    school_id: {
        type: INTEGER,
        primaryKey:true
    },
    workspace_id: INTEGER
},{
    sequelize,
    modelName: 'school_workspace',
    tableName: 'school_workspace',

    timestamps: false
});

module.exports = SchoolWorkspace;