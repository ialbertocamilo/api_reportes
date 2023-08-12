const { Model, 
    DataTypes: { INTEGER, STRING,DATE, BOOLEAN } 
   } = require('sequelize');

const sequelize = require('../sequelize.js');
/* models */
// const Taxonomie = require('./Taxonomie'); 

class Speaker extends Model {
}

Speaker.init({
    name: STRING,
    workspace_id: INTEGER,
},{
sequelize,
modelName: 'speakers',
tableName: 'speakers',
createdAt: 'created_at',
updatedAt: 'updated_at'
});

// Speaker.belongsTo(Taxonomie, {
//     foreignKey: 'type_id',
//     as: 'type'
// });

module.exports = Speaker;