import { GraduationCap } from "lucide-react";
import EntityManager from "../components/EntityManager";

const AddClass = () => (
  <EntityManager
    pageTitle="Manage Classes"
    pageDescription="Configure and manage academic classes for all educational boards."
    sectionTitle="Add New Academic Class"
    placeholder="Enter Class (e.g. 9th, 10th, 11th)"
    endpoint="/classes"
    entityName="classes"
    Icon={GraduationCap}
  />
);

export default AddClass;
