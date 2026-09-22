import { BookOpen } from "lucide-react";
import EntityManager from "../components/EntityManager";

const AddGroup = () => (
  <EntityManager
    pageTitle="Manage Academic Groups"
    pageDescription="Configure study disciplines and subject streams for matriculation and intermediate levels."
    sectionTitle="Add New Academic Group"
    placeholder="Enter Group Name (e.g. Science, Pre-Medical)"
    endpoint="/groups"
    entityName="groups"
    Icon={BookOpen}
  />
);

export default AddGroup;
