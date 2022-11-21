const { Model, 
        DataTypes: { INTEGER, STRING } 
       } = require('sequelize');

const sequelize = require('../sequelize.js');

class Workspace extends Model {
}

Workspace.init({
    name: STRING,
    slug: STRING,
    codigo_matricula: STRING
},{
    sequelize,
    modelName: 'workspaces',
    tableName: 'workspaces',

    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Workspace;