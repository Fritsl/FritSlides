-- Ensure columns use camelCase consistently
ALTER TABLE users RENAME COLUMN lastopenedprojectid TO "lastOpenedProjectId";
ALTER TABLE projects RENAME COLUMN userid TO "userId";
ALTER TABLE projects RENAME COLUMN startslogan TO "startSlogan";
ALTER TABLE projects RENAME COLUMN endslogan TO "endSlogan";
ALTER TABLE projects RENAME COLUMN lastviewedslideindex TO "lastViewedSlideIndex";
ALTER TABLE projects RENAME COLUMN islocked TO "isLocked";
ALTER TABLE projects RENAME COLUMN createdat TO "createdAt";
ALTER TABLE notes RENAME COLUMN projectid TO "projectId";
ALTER TABLE notes RENAME COLUMN parentid TO "parentId";
ALTER TABLE notes RENAME COLUMN linktext TO "linkText";
ALTER TABLE notes RENAME COLUMN youtubelink TO "youtubeLink";
ALTER TABLE notes RENAME COLUMN isdiscussion TO "isDiscussion";
ALTER TABLE notes RENAME COLUMN createdat TO "createdAt";
ALTER TABLE notes RENAME COLUMN updatedat TO "updatedAt";