const { Model, 
        DataTypes: { STRING, BOOLEAN } 
      } = require('sequelize');
const sequelize = require('../sequelize.js');

/* models */

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



module.exports = Schools;