const { 
        Model, 
        DataTypes: { INTEGER, STRING } 
      } = require('sequelize');

const sequelize = require('../sequelize.js');

class CampaignRequirement extends Model {
}

CampaignRequirement.init({
    campaign_id: INTEGER,
    criterio_id: INTEGER,
    type: STRING,
    condition: STRING,
    value: STRING,
},{
    sequelize,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName:'campaign_requirements'
})

module.exports = CampaignRequirement;