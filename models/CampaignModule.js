const { 
        Model, 
        DataTypes: { INTEGER } 
      } = require('sequelize');

const sequelize = require('../sequelize.js');

class CampaignModule extends Model {
}

CampaignModule.init({
    campaign_id: INTEGER,
    module_id: INTEGER,
},{
    sequelize,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'campaign_modules'
})

module.exports = CampaignModule;