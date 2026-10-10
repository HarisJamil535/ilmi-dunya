import BookLoader from "./BookLoader";
import { useLayoutEffect } from "react";

let visibleLoaders = 0;
let previousOverflow = "";

const PageLoader = ({ label = "Loading ..." }) => {
  useLayoutEffect(() => {
    if (visibleLoaders === 0) previousOverflow = document.documentElement.style.overflow;
    visibleLoaders += 1;
    document.documentElement.style.overflow = "hidden";
    return () => {
      visibleLoaders -= 1;
      if (visibleLoaders === 0) document.documentElement.style.overflow = previousOverflow;
    };
  }, []);
  return <div className="page-loader" data-page-loader="">
    <BookLoader size={96} label={label} />
  </div>;
};

export default PageLoader;
