const { Model, 
        DataTypes: { INTEGER, STRING } 
      } = require('sequelize');
const sequelize = require('../sequelize.js');

class VademecumModule extends Model {
}

VademecumModule.init({
    vademecum_id: INTEGER,
    module_id: INTEGER
},{
    sequelize,
    modelName: 'vademecum_module',
    tableName: 'vademecum_module',
    timestamps: false
});

module.exports = VademecumModule;