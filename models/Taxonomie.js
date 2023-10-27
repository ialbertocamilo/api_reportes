const { Model, 
        DataTypes: { STRING, BOOLEAN } 
      } = require('sequelize');
const sequelize = require('../sequelize.js');

/* models */
class Taxonomie extends Model {
}

Taxonomie.init({
    name: STRING,
    description:STRING,
    code:STRING,
    active: BOOLEAN
},{
    sequelize,
    modelName: 'taxonomies',
    tableName: 'taxonomies',

    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Taxonomie;