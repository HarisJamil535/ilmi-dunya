import { Landmark } from "lucide-react";
import EntityManager from "../components/EntityManager";

const AddBoards = () => (
  <EntityManager
    pageTitle="Manage Educational Boards"
    pageDescription="Configure and map examination boards for academic curriculum."
    sectionTitle="Add New Educational Board"
    placeholder="Enter Board Name (e.g. Federal Board, BISE Lahore)"
    endpoint="/boards"
    entityName="boards"
    Icon={Landmark}
  />
);

export default AddBoards;
