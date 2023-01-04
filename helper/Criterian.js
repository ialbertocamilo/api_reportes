const { con } = require('../db');
const Criterian = require('../models/Criterian');
const CriterionValue = require('../models/CriterionValue');
const CriterionValueUser = require('../models/CriterionValueUser');

exports.getCriterianUserByCode = async (UserId, UserCode, Instance = false ) => {

	const criterianValues = await Criterian.findOne({  	where:{ code: UserCode },
													  	include:[{ 
												  					model: CriterionValue,
													  				include: [{ 
												  								model: CriterionValueUser, 
												  								where: { user_id: UserId }
												  							 }],
													  			}]
										  			});

	if(Instance) return criterianValues;

	if(criterianValues) {
		let _criterianValues = criterianValues.criterion_values[0];

		if(_criterianValues) return _criterianValues.value_text;
		return _criterianValues; 

	} else criterianValues;

	/*return (Instance) ? criterianValues : criterianValues?.criterion_values[0]?.value_text;*/
}

exports.loadCriterionValuesByUser = async (userId) => {

		  // GROUP_CONCAT(cv.value_text SEPARATOR ', ') value_text,
	let query = `
	  select 
		  cvu.user_id, 
		  cv.criterion_id,
		  c.name criterion_name,
		  cv.value_text,
		  cv.value_datetime,
		  cv.value_date,
		  cv.value_boolean,
		  cv.value_decimal,
		  cv.value_integer
	  from
		  users u
			  inner join criterion_value_user cvu on cvu.user_id = u.id
			  inner join criterion_values cv on cv.id = cvu.criterion_value_id
			  inner join criteria c on c.id = cv.criterion_id
	  where
		c.show_in_reports = 1
		and u.id = ${userId}

		group by cv.criterion_id 
	  `;
  
	const [rows] = await con.raw(query);
	  
	return rows;
  };