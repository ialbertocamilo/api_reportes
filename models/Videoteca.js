const { Model, 
        DataTypes: { INTEGER, STRING } 
      } = require('sequelize');
const sequelize = require('../sequelize.js');

class Videoteca extends Model {
}

Videoteca.init({
    workspace_id: INTEGER,
    title: STRING
},{
    sequelize,
    modelName: 'videoteca',
    tableName: 'videoteca',
    timestamps: false
});

module.exports = Videoteca;