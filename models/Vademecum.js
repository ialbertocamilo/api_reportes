const { Model, 
        DataTypes: { INTEGER, STRING } 
      } = require('sequelize');
const sequelize = require('../sequelize.js');

class Vademecum extends Model {
}

Vademecum.init({
    name: STRING,
},{
    sequelize,
    modelName: 'vademecum',
    tableName: 'vademecum',

    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Vademecum;