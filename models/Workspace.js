const { Model, 
        DataTypes: { INTEGER, STRING } 
       } = require('sequelize');

const sequelize = require('../sequelize.js');

class Workspace extends Model {
}

Workspace.init({
    name: STRING,
    slug: STRING
},{
    sequelize,
    modelName: 'workspaces',
    tableName: 'workspaces',

    timestamps: false
});

module.exports = Workspace;