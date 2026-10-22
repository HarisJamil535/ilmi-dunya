import { useEffect, useState } from "react";
import axiosInstance from "../api/axios";

// The school list is the same for every visitor, so forms opened within a minute share one request.
let schoolsRequest = null;
let schoolsRequestedAt = 0;
const loadSchools = () => {
  if (!schoolsRequest || Date.now() - schoolsRequestedAt > 60000) {
    schoolsRequestedAt = Date.now();
    const request = axiosInstance.get("/schools").then((response) => response.data.schools || []).catch((error) => {
      if (schoolsRequest === request) schoolsRequest = null;
      throw error;
    });
    schoolsRequest = request;
  }
  return schoolsRequest;
};

export const emptySchoolChoice = { schoolId: "", school: "", schoolClassId: "", schoolSectionId: "" };

// Checks a choice against the loaded school list; returns messages keyed by field.
export const validateSchoolChoice = (choice, schools) => {
  const errors = {};
  if (!choice.schoolId) {
    errors.schoolId = "Select your school.";
  } else if (choice.schoolId === "other") {
    if (choice.school.trim().length < 2) errors.school = "Enter your school name.";
  } else if (choice.schoolId !== "private") {
    const school = schools.find((item) => item._id === choice.schoolId);
    if (!school) errors.schoolId = "Select your school.";
    else if (school.classes.length) {
      const grade = school.classes.find((item) => item._id === choice.schoolClassId);
      if (!grade) errors.schoolClassId = "Select your class.";
      else if (grade.sections.length && !grade.sections.some((item) => item._id === choice.schoolSectionId)) errors.schoolSectionId = "Select your section.";
    }
  }
  return errors;
};

// Turns a student's saved profile into the form's initial choice.
export const choiceFromStudent = (student, schools) => {
  if (!student) return emptySchoolChoice;
  const school = schools.find((item) => item._id === student.schoolId);
  if (school) {
    const grade = school.classes.find((item) => item.name === student.schoolClass);
    const section = grade?.sections.find((item) => item.name === student.schoolSection);
    return { schoolId: school._id, school: "", schoolClassId: grade?._id || "", schoolSectionId: section?._id || "" };
  }
  if (student.school === "Private Student") return { ...emptySchoolChoice, schoolId: "private" };
  return student.school ? { ...emptySchoolChoice, schoolId: "other", school: student.school } : emptySchoolChoice;
};

export const useSchools = () => {
  const [state, setState] = useState({ schools: [], loading: true, failed: false });
  useEffect(() => {
    let active = true;
    loadSchools()
      .then((schools) => active && setState({ schools, loading: false, failed: false }))
      .catch(() => active && setState({ schools: [], loading: false, failed: true }));
    return () => { active = false; };
  }, []);
  return state;
};
