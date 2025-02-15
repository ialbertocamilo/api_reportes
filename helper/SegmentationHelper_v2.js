const moment = require("moment");
const { con } = require("../db");
const { loadTopicsByCourseId, getCourseStatusId, loadEvaluationTypes } = require("./CoursesTopicsHelper");
const {
  groupArrayOfObjects,
  groupArrayOfObjects_v2,
  uniqueElements,
  pluckUnique,
  logtime,
  pluck,
} = require("./Helper");
const { getSuboworkspacesIds } = require('./Workspace')
const { getSchoolsCoursesIds } = require('./Courses')

const StackBuildQuery = {
  // sides: relacion ('inner','left','right','cross')
  // num: nro de tablas
  setCustomSideJoin(sides, num) { 
    const bySides = sides.split(',');
    const countBySides = bySides.length;

    if(countBySides > num) return console.error('error:sides es mayor a num'); //error
    if(countBySides === num) return bySides;

    // rellenamos hasta que iguale a num 
    const diffSides = (num - countBySides);
    const lastValue = bySides[countBySides - 1];

    for (let i = 0; i < diffSides; i++) {
      bySides.push(lastValue)
    }

    return bySides;
  },

};

function calcStackByNumber(stack, bystack) {
   const counStack = stack.length;
   let SaveStack = [];

   if(counStack <= bystack && counStack) {
      SaveStack.push(stack);
      return SaveStack;
   }

   const calcNumStack = Math.ceil(counStack / bystack);
   let prevIndex = 0,
       nextIndex = 0;

   for (let i = 0; i < calcNumStack; i++) {
      prevIndex = nextIndex;
      nextIndex = prevIndex + bystack;
      
      const currentVal = stack.slice(prevIndex, nextIndex);
      SaveStack.push(currentVal);
   }

   return SaveStack;
}

async function resolvePromisesAndGetUsers (ArrayPromises) {
    const StackResponse = await Promise.allSettled(ArrayPromises);
   let users = [];

   for(const response of StackResponse) {
      const { value:[ currents ], status } = response;
      if (status === 'fulfilled') users.push(...currents);
    }

    return users;
}

async function loadUsersSegmentedByCourse (course_id, modules,
                                      areas, activeUsers, inactiveUsers,model_type = 'App\\Models\\Course',code_user = 'employee'
                                      ,notConsiderUsersId='') {
                                        
    const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", model_type)
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
    const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
    );
    let userTypesIds = [];
    if (code_user === 'employee') {
      const userTypes = await con('taxonomies')
        .select('id')
        .where('group','user')
        .where('type','type')
        .whereIn('code', ['employee', 'client']);

      userTypesIds = pluck(userTypes, 'id');

    } else {
      const type_user = await con('taxonomies')
        .select('id')
        .where('group','user')
        .where('type','type')
        .where('code',code_user)
        .first();

      userTypesIds.push(type_user.id)
    }


    // === filtro para modulos ===
    const modules_query = modules && modules.length > 0
    ? `and u.subworkspace_id in (${modules.join()})`
    : ``;
    // === filtro para modulos ===

    // === filtro para usuarios ===
    let where_active_users = '';
    if(activeUsers && !inactiveUsers) where_active_users += ` and u.active = 1`;
    if(!activeUsers && inactiveUsers) where_active_users += ` and u.active = 0`;
    if(notConsiderUsersId != ''){ where_active_users += ` and u.id not in (${notConsiderUsersId}) ` };
    // === filtro para usuarios ===

    // === filtro para areas ===
    let join_criterions_values_user_area = '';
    let where_criterions_values_user_area = '';

    if(areas.length) {
      join_criterions_values_user_area += ` 
        inner join criterion_value_user cvu 
          on cvu.user_id = u.id
        inner join criterion_values cv 
          on cvu.criterion_value_id = cv.id `;
  
      where_criterions_values_user_area += ` 
        and cvu.criterion_value_id in ( ${areas.join()} )`
    }
    // === filtro para areas ===

    let ArrayPromises = [];
    for (segment of segments_groupby) {
      const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
      let join_criterions_values_user = "";
      grouped.forEach((values, idx) => {
        if (values[0].code != "date") {
          const criterios_id = pluckUnique(
            values,
            "criterion_value_id"
          ).toString();
          join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
        } else {
          let select_date = "select id from criterion_values where ";
          values.forEach((value, index) => {
            const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
            const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
            select_date += ` ${index > 0 ? "or" : ""
              } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
              }`;
          });
          select_date += " and deleted_at is null";
          join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on u.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
        }
      });

      // const [ rows ] = await con.raw(
      const currentPromise = con.raw(
      ` select 
          u.id 
        from users u
          ${join_criterions_values_user} 
          ${join_criterions_values_user_area}
        where 
          u.deleted_at is null
          ${where_active_users}
          ${modules_query}
          and u.type_id in (${userTypesIds.join(',')})
          ${where_criterions_values_user_area}
      `);

      ArrayPromises.push(currentPromise);
    }

    const users = await resolvePromisesAndGetUsers(ArrayPromises);
    return uniqueElements(users, "id");
};
exports.loadUsersSegmentedByCourse  = loadUsersSegmentedByCourse;
// ==== loadUsersSegmentedTest 1 ==== 259034.692ms  227429.066 ms 231821.527 ms
exports.loadUsersSegmented = async (course_id) => {
  // select `id` from `users`
  // inner join `criterion_value_user` as `cvu1` on `users`.`id` = `cvu1`.`user_id` and `cvu1`.`criterion_value_id` in (?)
  // inner join `criterion_value_user` as `cvu46` on `users`.`id` = `cvu46`.`user_id` and `cvu46`.`criterion_value_id` in (?)
  // where `active` = ?
  const segments = await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.starts_at",
      "sv.finishes_at",
      "sv.segment_id",
      "sv.criterion_value_id",
      "t.code"
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .join("taxonomies as t", "t.id", "c.field_id")
    .where("sg.model_type", "App\\Models\\Course")
    .where("sg.model_id", course_id)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
  const segments_groupby = groupArrayOfObjects(
    segments,
    "segment_id",
    "get_array"
  );
  let users = [];
  for (segment of segments_groupby) {
    const grouped = groupArrayOfObjects(segment, "criterion_id", "get_array");
    let join_criterions_values_user = "";
    grouped.forEach((values, idx) => {
      if (values[0].code != "date") {
        const criterios_id = pluckUnique(
          values,
          "criterion_value_id"
        ).toString();
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${criterios_id}) `;
      } else {
        let select_date = "select id from criterion_values where ";
        values.forEach((value, index) => {
          const starts_at = moment(value.starts_at).format("YYYY-MM-DD");
          const finishes_at = moment(value.finishes_at).format("YYYY-MM-DD");
          select_date += ` ${index > 0 ? "or" : ""
            } value_date between '${starts_at}' and '${finishes_at}' and criterion_id=${value.criterion_id
            }`;
        });
        select_date += " and deleted_at is null";
        join_criterions_values_user += `inner join criterion_value_user as cvu${idx} on users.id = cvu${idx}.user_id and cvu${idx}.criterion_value_id in (${select_date}) `;
      }
    });
    const [rows] =
      await con.raw(`select users.id , users.name,users.lastname,users.surname,users.email, users.document ,sc.grade_average,sc.advanced_percentage,sc.status_id,sc.created_at as sc_created_at from users
        LEFT OUTER join summary_courses sc on sc.user_id = users.id and sc.course_id = ${course_id}
        ${join_criterions_values_user} 
        where users.active=1 
        and users.deleted_at is null`);
    if (rows.length > 0) {
      users = [...users, ...rows];
    }
  }
  return uniqueElements(users, "id");
};
// ==== loadUsersSegmentedTest 1 ==== 259034.692ms  227429.066 ms 231821.527 ms

exports.loadUsersSegmentedv2 = async (
  course_id,
  modules = [],
  areas = [],

  start_date = null,
  end_date = null,

  activeUsers = false,
  inactiveUsers = false,

  completed,
  includePersonalData=false
) => {
  logtime('start: user ids segmentation');
  // === extraer ids de usuarios segmentados ===
   const LoadUsersData = await loadUsersSegmentedByCourse(course_id, modules, 
                                                     areas, activeUsers, inactiveUsers);
   const StacksUsersIds = pluck(LoadUsersData, 'id');
    // === extraer ids de usuarios segmentados ===
  logtime('end: user ids segmentation');

    // === para 'completed' es boolean
    const StackSidesCompleted = completed ? 'left': 'inner';
    const [ first ] = StackBuildQuery.setCustomSideJoin(StackSidesCompleted, 4);
    // === para 'completed' es boolean

    // === filtro para fecha ===
    const start_date_query = start_date
    ? ` and date(sc.updated_at) >= '${start_date}'`
    : ``;
    const end_date_query = end_date
    ? ` and date(sc.updated_at) <= '${end_date}'`
    : ``;
    // === filtro para fecha ===

    const ArrayStackUserIds = calcStackByNumber(StacksUsersIds, 1000);

    // logtime('start: users_test');
    function buildQueryUsersIds(userValues) {
      const query = `
     select 
        u.id,
        ${includePersonalData ? ' u.name,u.lastname,u.surname,u.document,u.phone_number, ' : ''}
        sc.grade_average, sc.advanced_percentage,
        sc.status_id, sc.created_at as sc_created_at,
        sc.views as course_views, sc.passed as course_passed, 
        sc.assigned, sc.completed,
        sc.last_time_evaluated_at, sc.restarts,
        sc.taken, sc.reviewed, sc.assigned,
        sc.status_id as course_status_id,
        sc.course_id

     from users u
    
        ${first} join summary_courses sc 
        on sc.user_id = u.id 
        and sc.course_id = ${course_id} 

      where 
        u.id in (${userValues.join()})
        ${start_date_query} ${end_date_query}`;

      return query;
    }

    let ArrayPromises = [];
    for (const userValues of ArrayStackUserIds) {
      const currentQuery = buildQueryUsersIds(userValues);
      const currentPromise = con.raw(currentQuery);
      ArrayPromises.push(currentPromise);
    }

    return await resolvePromisesAndGetUsers(ArrayPromises);
};

// ==== loadUsersSegmentedTest 2 ==== 223473.524 ms  224447.022 ms

exports.loadUsersSegmentedv2WithSummaryTopics = async (
  course_id,
  modules = [],
  areas = [],
  temas = [],

  start_date = null,
  end_date = null,

  activeUsers = false,
  inactiveUsers = false,

  activeTopics = false,
  inactiveTopics = false,

  completed,
  StacksUsersIds = []
) => {

  // === extraer ids de usuarios segmentados ===

  const segmentedUsers = await loadUsersSegmentedByCourse(course_id, modules,
    areas, activeUsers, inactiveUsers);

  // When StacksUsersIds has items, filter those who
  // are also included in segmented users

  if (StacksUsersIds.length) {
    let segmentedUsersIds = pluck(segmentedUsers, 'id');
    StacksUsersIds = StacksUsersIds.filter(id => segmentedUsersIds.includes(id))
  } else {
    StacksUsersIds = pluck(segmentedUsers, 'id');
  }


  	// === extraer ids de usuarios segmentados ===

    // === para 'completed' es boolean
    const StackSidesCompleted = completed ? 'left,inner,inner,left': 'inner';
    const [ first, second,
          third, fourth ] = StackBuildQuery.setCustomSideJoin(StackSidesCompleted, 4);
    // === para 'completed' es boolean

    // === filtro para fecha ===
    const start_date_query = start_date
    ? ` and date(st.updated_at) >= '${start_date}'`
    : ``;
    const end_date_query = end_date
    ? ` and date(st.updated_at) <= '${end_date}'`
    : ``;
    // === filtro para fecha ===

    // === filtro para topics ===
    let where_in_topics = (temas.length) ? ` and t.id in(${temas.join()}) `: ` and t.deleted_at is null `;
    let where_active_topics = '';
    if(activeTopics && !inactiveTopics) where_active_topics += `and t.active = 1`;
    if(!activeTopics && inactiveTopics) where_active_topics += `and t.active = 0`;
    // === filtro para topics ===

    const ArrayStackUserIds = calcStackByNumber(StacksUsersIds, 1000);

    // logtime('start: users_test');
    function buildQueryUsersIds(userValues) {
      const query = `
      select 
        u.id,
        t.id topic_id,

        sc.status_id as course_status_id,
        sc.restarts course_restarts,
        sc.created_at sc_created_at, 

        st.grade topic_grade,
        st.attempts topic_attempts,
        st.total_attempts topic_total_attempts,
        st.restarts topic_restarts,
        st.views topic_views,
        st.status_id topic_status_id,
        st.last_time_evaluated_at topic_last_time_evaluated_at,
        json_extract(c.mod_evaluaciones, '$.nota_aprobatoria') minimum_grade

      from users u
      
        ${first} join summary_courses sc 
          on sc.user_id = u.id and sc.course_id = ${course_id}
        ${second} join courses c 
          on c.id = ${course_id}
        ${third} join topics t 
          on t.course_id = c.id
        ${fourth} join summary_topics st 
          on st.topic_id = t.id and st.user_id = u.id

      where 
        u.id in (${userValues.join()})
        
        ${where_in_topics}
        ${where_active_topics}
        
        ${start_date_query} ${end_date_query}`;

     return query;
  }
  
  let ArrayPromises = [];
    for (const userValues of ArrayStackUserIds) {
      const currentQuery = buildQueryUsersIds(userValues);
      const currentPromise = con.raw(currentQuery);
      ArrayPromises.push(currentPromise);
    }

    return await resolvePromisesAndGetUsers(ArrayPromises);
};
// ==== loadUsersSegmentedTest 2 ==== 218798.702 ms - 185027.317 ms - 3722165.039 ms

exports.loadUsersSegmentedv2WithSummaryTopicsNoEva = async (
  course_id,
  modules = [],
  areas = [],
  temas = [],

  start_date = null,
  end_date = null,
  
  activeUsers = false,
  inactiveUsers = false,

  activeTopics = false,
  inactiveTopics = false,

  completed
) => {
  logtime('start: user ids segmentation');
  // === extraer ids de usuarios segmentados ===
   const LoadUsersData = await loadUsersSegmentedByCourse(course_id, modules, 
                                                     areas, activeUsers, inactiveUsers);
   const StacksUsersIds = pluck(LoadUsersData, 'id');
    // === extraer ids de usuarios segmentados ===
  logtime('end: user ids segmentation');
  
    // === para 'completed' es boolean
    const StackSidesCompleted = completed ? 'left,inner,inner,left': 'inner';
    const [ first, second,
          third, fourth ] = StackBuildQuery.setCustomSideJoin(StackSidesCompleted, 4);
    // === para 'completed' es boolean

    // === filtro para fecha ===
    const start_date_query = start_date
    ? ` and date(st.updated_at) >= '${start_date}'`
    : ``;
    const end_date_query = end_date
    ? ` and date(st.updated_at) <= '${end_date}'`
    : ``;
    // === filtro para fecha ===

    // === filtro para topics ===
    let where_in_topics = (temas.length) ? ` and t.id in(${temas.join()}) `: ``;
    let where_active_topics = '';
    if(activeTopics && !inactiveTopics) where_active_topics += `and t.active = 1`;
    if(!activeTopics && inactiveTopics) where_active_topics += `and t.active = 0`;
    // === filtro para topics ===

    const ArrayStackUserIds = calcStackByNumber(StacksUsersIds, 1000);

    // logtime('start: users_test');
    function buildQueryUsersIds(userValues) {
    const query = `
     select 
        u.id,
        t.id topic_id,

        sc.created_at as sc_created_at,

        st.grade topic_grade,
        st.views topic_views,
        st.status_id topic_status_id

     from users u
         ${first} join summary_courses sc 
            on sc.user_id = u.id 
            and sc.course_id = ${course_id}
          ${second} join courses c 
            on c.id = ${course_id}
          ${third} join topics t 
            on t.course_id = c.id
          ${fourth} join summary_topics st 
            on st.topic_id = t.id and st.user_id = u.id

    where 
      u.id in (${userValues.join()})
      and t.assessable = 0 
      
      ${where_in_topics}
      ${where_active_topics}
      
      ${start_date_query} ${end_date_query}`;

    return query;
    }

   let ArrayPromises = [];
    for (const userValues of ArrayStackUserIds) {
      const currentQuery = buildQueryUsersIds(userValues);
      const currentPromise = con.raw(currentQuery);
      ArrayPromises.push(currentPromise);
    }

    return await resolvePromisesAndGetUsers(ArrayPromises);
}

exports.loadUsersSegmentedv2WithSummaryTopicsEva = async (
  course_id,
  modules = [],
  areas = [],
  temas = [],

  start_date = null,
  end_date = null,
  
  activeUsers = false,
  inactiveUsers = false,

  activeTopics = false,
  inactiveTopics = false,

  completed
) => {
  logtime('start: user ids segmentation');
  // === extraer ids de usuarios segmentados ===
   const LoadUsersData = await loadUsersSegmentedByCourse(course_id, modules, 
                                                     areas, activeUsers, inactiveUsers);
   const StacksUsersIds = pluck(LoadUsersData, 'id');
    // === extraer ids de usuarios segmentados ===
  logtime('end: user ids segmentation');
  
    // === para 'completed' es boolean
    const StackSidesCompleted = completed ? 'left,inner,inner,left': 'inner';
    const [ first, second,
          third, fourth ] = StackBuildQuery.setCustomSideJoin(StackSidesCompleted, 4);
    // === para 'completed' es boolean

    // === filtro para fecha ===
    const start_date_query = start_date
    ? ` and date(st.updated_at) >= '${start_date}'`
    : ``;
    const end_date_query = end_date
    ? ` and date(st.updated_at) <= '${end_date}'`
    : ``;
    // === filtro para fecha ===

    // === filtro para topics ===
    let where_in_topics = (temas.length) ? ` and t.id in(${temas.join()}) `: ``;
    let where_active_topics = '';
    if(activeTopics && !inactiveTopics) where_active_topics += `and t.active = 1`;
    if(!activeTopics && inactiveTopics) where_active_topics += `and t.active = 0`;
    // === filtro para topics ===

    const ArrayStackUserIds = calcStackByNumber(StacksUsersIds, 1000);

    // Get id of open evaluation

    const evaluationsTypes = await loadEvaluationTypes();
    const openEvaluation = evaluationsTypes.find(item => item.code === 'open')
    const openEvaluationId = openEvaluation ? openEvaluation.id : null;

    // logtime('start: users_test');
    function buildQueryUsersIds(userValues) {
    const second_query = `
    select 
      u.id,
      t.id topic_id,
      st.answers,

      sc.created_at as sc_created_at,

      st.views topic_views,
      st.status_id topic_status_id

    from users u
      ${first} join summary_courses sc 
         on sc.user_id = u.id 
         and sc.course_id = ${course_id}
      ${second} join courses c 
         on c.id = ${course_id}
      ${third} join topics t 
         on t.course_id = c.id
      ${fourth} join summary_topics st 
         on st.topic_id = t.id and st.user_id = u.id

    where 
      u.id in (${userValues.join()})
      and t.type_evaluation_id = ${openEvaluationId}
      and t.assessable = 1
      
      ${where_in_topics}
      ${where_active_topics}
      
      ${start_date_query} ${end_date_query}`;

      // logtime(second_query);
    return second_query;
   }

   let ArrayPromises = [];
    for (const userValues of ArrayStackUserIds) {
      const currentQuery = buildQueryUsersIds(userValues);
      const currentPromise = con.raw(currentQuery);
      ArrayPromises.push(currentPromise);
    }

    return await resolvePromisesAndGetUsers(ArrayPromises);
}

exports.loadCourses = async (
  { cursos = [], 
    escuelas = [],
    
    CursosActivos,
    CursosInactivos,

    tipocurso }, workspaceId) => {

  let query = `
    select  
    
      cs.course_id,
      c.name as course_name,
      s.name as school_name,
      c.active as course_active,
      tx.name as course_type

    from course_school as cs

      inner join courses as c 
        on c.id = cs.course_id
      inner join schools as s
        on s.id = cs.school_id
      inner join taxonomies as tx
        on tx.id = c.type_id 
      inner join school_workspace as sw
        on sw.school_id = s.id

    where  
      sw.workspace_id = ${workspaceId}  
      and c.deleted_at is null 
  `;

  // posible filtro en estado de curso
  if(CursosActivos && !CursosInactivos) query += ` and c.active = 1`;
  if(!CursosActivos && CursosInactivos) query += ` and c.active = 0`;

  if(cursos.length) query += ` and cs.course_id in (${cursos.join()})`;
  if(escuelas.length) query += ` and cs.school_id in (${escuelas.join()})`;
  if(!tipocurso) query += ` and not tx.code = 'free'`;
  
  query += ` group by cs.course_id`;

  // logtime(query);

  const [rows] = await con.raw(query);
  return rows;
};

//LoadCourses using subworkspace_id table
exports.loadCoursesV3 = async (
  { cursos = [],
    escuelas = [],

    CursosActivos,
    CursosInactivos,

    tipocurso }, subworkspacesIds) => {

  let query = `
    select  
    
      cs.course_id,
      c.name as course_name,
      s.name as school_name,
      s.id as school_id,
      c.qualification_type_id,
      c.active as course_active,
      tx.name as course_type

    from course_school as cs

      inner join courses as c 
        on c.id = cs.course_id
      inner join schools as s
        on s.id = cs.school_id
      inner join taxonomies as tx
        on tx.id = c.type_id 
      inner join school_subworkspace as sw
        on sw.school_id = s.id

    where  
    sw.subworkspace_id in (${subworkspacesIds.join()})  
      and c.deleted_at is null 
  `;

  // posible filtro en estado de curso
  if(CursosActivos && !CursosInactivos) query += ` and c.active = 1`;
  if(!CursosActivos && CursosInactivos) query += ` and c.active = 0`;

  if(cursos.length) query += ` and cs.course_id in (${cursos.join()})`;
  if(escuelas.length) query += ` and cs.school_id in (${escuelas.join()})`;
  if(!tipocurso) query += ` and not tx.code = 'free'`;

  query += ` group by cs.course_id`;

  // logtime(query);

  const [rows] = await con.raw(query);
  return rows;
};

//LoadCourses using subworkspace_id table
exports.loadCoursesV3 = async (
  { cursos = [],
    escuelas = [],

    CursosActivos,
    CursosInactivos,

    tipocurso }, subworkspacesIds) => {

  let query = `
    select  
    
      cs.course_id,
      c.name as course_name,
      s.name as school_name,
      s.id as school_id,
      c.qualification_type_id,
      c.active as course_active,
      c.modality_in_person_properties,
      tx.name as course_type,
      c.modality_id
    from course_school as cs

      inner join courses as c 
        on c.id = cs.course_id
      inner join schools as s
        on s.id = cs.school_id
      inner join taxonomies as tx
        on tx.id = c.type_id 
      inner join school_subworkspace as sw
        on sw.school_id = s.id

    where  
    sw.subworkspace_id in (${subworkspacesIds.join()})  
      and c.deleted_at is null 
  `;

  // posible filtro en estado de curso
  if(CursosActivos && !CursosInactivos) query += ` and c.active = 1`;
  if(!CursosActivos && CursosInactivos) query += ` and c.active = 0`;

  if(cursos.length) query += ` and cs.course_id in (${cursos.join()})`;
  if(escuelas.length) query += ` and cs.school_id in (${escuelas.join()})`;
  if(!tipocurso) query += ` and not tx.code = 'free'`;

  query += ` group by cs.course_id`;

  // logtime(query);

  const [rows] = await con.raw(query);
  return rows;
};

exports.loadCoursesV2 = async (
{ escuelas = [],
  cursos = [],
  temas = [],

  CursosActivos,
  CursosInactivos,

  tipocurso }, 
  workspaceId,
  deleted_at = true) => {

  let subworkspacesIds = await getSuboworkspacesIds(workspaceId)

  let query = `
    select  
    
      cs.course_id,
      c.name as course_name,
      s.name as school_name,
      c.active as course_active,
      tx.name as course_type,
      c.modality_id 
    from course_school as cs

      inner join courses as c 
        on c.id = cs.course_id
      inner join schools as s
        on s.id = cs.school_id
      inner join taxonomies as tx
        on tx.id = c.type_id 
      inner join school_subworkspace as sw
        on sw.school_id = s.id
      inner join topics as t
          on t.course_id = c.id
        
    where  
      t.deleted_at is null  
      and sw.subworkspace_id in( ${subworkspacesIds.join()} )
  `
  if(deleted_at) query += ` and c.deleted_at is null `; // mms para eliminado

  // posible filtro en estado de curso
  if(CursosActivos && !CursosInactivos) query += ` and c.active = 1`;
  if(!CursosActivos && CursosInactivos) query += ` and c.active = 0`;

  if(cursos.length) query += ` and cs.course_id in (${cursos.join()})`;
  if(escuelas.length) query += ` and cs.school_id in (${escuelas.join()})`;
  if(temas.length) query += ` and t.id in (${temas.join()})`;
  if(!tipocurso) query += ` and not tx.code = 'free'`;
  
  query += ` group by cs.course_id`;
  // logtime(query);
  const [rows] = await con.raw(query);
  return rows;
}

exports.getCountTopics = async (course_id) => {
  const [ count ] = await con.raw(`
      select 
        count(*) as counter
      from 
        topics t 
      where 
        t.course_id = ${course_id}
        and t.deleted_at is null
        and t.active = 1`);

  return count[0].counter;
}

async function loadCoursesSegmentedToUsersInSchool (schoolsIds, usersIds) {

  const schoolsCourses = await getSchoolsCoursesIds(schoolsIds)
  const schoolsCoursesIds = pluckUnique(schoolsCourses, 'course_id')

  // School courses' segments

  const segments = await loadSegments(
    "App\\Models\\Course", schoolsCoursesIds
  );

  const segmentsUsersCriterionValues = await loadUsersSegmentsCriterionValues(segments, usersIds)

  // Get segmented courses of each user

  let addedUsers = []
  let usersCourses = []
  usersIds.forEach(userId => {

    let matchesSegmentsIds = userMatchesSegments(userId, segments, segmentsUsersCriterionValues.filter(u => +u.user_id === +userId))

      for (let i = 0; i < segments.length; i++) {
        if (matchesSegmentsIds.includes(segments[i].segment_id)) {

            if (!addedUsers.includes(userId)) {
              addedUsers.push(userId)
              usersCourses[userId] = []
            }

            let schoolCourseToBeAdded = schoolsCourses.find(sc => +sc.course_id === +segments[i].course_id)
            if (schoolCourseToBeAdded) {
              let schoolAlreadyAdded = usersCourses[userId].find(uc => {
                return uc.school_id === schoolCourseToBeAdded.school_id &&
                  uc.course_id === schoolCourseToBeAdded.course_id
              })
              if (!schoolAlreadyAdded) {
                usersCourses[userId].push(schoolCourseToBeAdded)
              }
            }
        }
      }

  })

  return usersCourses
}
exports.loadCoursesSegmentedToUsersInSchool = loadCoursesSegmentedToUsersInSchool

/**
 * Checks whether user criteria values matches segments
 * @returns {*[]}
 */
function userMatchesSegments(userId, segments, userCriteriaValues) {

  if (!userCriteriaValues) return []
  if (!segments) return []

  let processedSegments = []
  let matchesSegmentsIds = []
  segments.forEach(segment => {

    const segmentId = +segment.segment_id
    const processed = processedSegments.includes(segmentId)
    if (!processed) {
      processedSegments.push(segmentId)
      let segmentValues = segments.filter(s => +s.segment_id === segmentId)
      let uniqueCriterionIds = pluckUnique(segmentValues, 'criterion_id')
      let userCriterionMatches = []
      segmentValues.forEach(sv => {
        let starts_at;
        let finishes_at;
        if (sv.starts_at && sv.finishes_at) {
          starts_at = moment(sv.starts_at, 'YYYY-MM-DD');
          finishes_at = moment(sv.finishes_at, 'YYYY-MM-DD');
        }

        let userCriteriaValue = userCriteriaValues.find(uscv => {
          let matches =
            +sv.criterion_value_id === +uscv.criterion_value_id &&
            +sv.criterion_id === +uscv.criterion_id;

            if (matches) {
              return matches
            } else  {

              if (starts_at && finishes_at) {
                const userDate = moment(uscv.value_text.substring(0, 10), 'YYYY-MM-DD')
                return userDate
                  ? userDate.isBetween(starts_at, finishes_at)
                  : false
              }
            }

            return false;
        })

        // Save criterion id of found value
        if (userCriteriaValue) {
          if (!userCriterionMatches.includes(userCriteriaValue.criterion_id)) {
            userCriterionMatches.push(userCriteriaValue.criterion_id)
          }
        }
      })

      // At least one of every criteria should match

      if (uniqueCriterionIds.length <= userCriterionMatches.length) {
        matchesSegmentsIds.push(segmentId)
      }
    }
  })

  return matchesSegmentsIds
}
exports.userMatchesSegments = userMatchesSegments;

/**
 * Load segments of any type
 */
async function loadSegments (modelType, modelIds) {

  return await con("segments_values as sv")
    .select(
      "sv.criterion_id",
      "sv.segment_id",
      "sv.criterion_value_id",
      'sv.starts_at',
      'sv.finishes_at',
      // 'sv.days_less_than',
      // 'sv.days_greater_than',
      // 'sv.days_duration',
      "sg.model_id as course_id",
    )
    .join("segments as sg", "sg.id", "sv.segment_id")
    .join("criteria as c", "c.id", "sv.criterion_id")
    .where("sg.model_type", modelType)
    .whereIn("sg.model_id", modelIds)
    .where("sg.deleted_at", null)
    .where("sv.deleted_at", null);
}
exports.loadSegments = loadSegments;

/**
 * Load users with their criterion values according segments
 */
async function loadUsersSegmentsCriterionValues(segments, usersIds) {

  let criteriaIds = pluckUnique(segments, 'criterion_id').filter((e) => e !== null)

  // Load users criterion values

  const query = `
    select 
        cvu.user_id, 
        cvu.criterion_value_id, 
        cv.criterion_id,
        cv.value_text
    from 
        criterion_value_user cvu
        join criterion_values cv on cv.id = cvu.criterion_value_id
    where
        cvu.user_id in (${usersIds.join(',')}) 
        and cv.criterion_id in (${criteriaIds.join(',')})
  `
  const [segmentsUsersCriterionValues] = await con.raw(query);

  return segmentsUsersCriterionValues;
}
exports.loadUsersSegmentsCriterionValues = loadUsersSegmentsCriterionValues;
