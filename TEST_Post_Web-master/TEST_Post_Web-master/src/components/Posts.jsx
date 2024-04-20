import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { GET_LIST_POST } from "../constant";
import Post from "./Post";

const Posts = () => {
  const dispatch = useDispatch();
  const { posts, load, page } = useSelector((state) => state.posts);
  const bottomRef = useRef();
  const [postsData, setPostsData] = useState([]);

  useEffect(() => {
    dispatch({ type: GET_LIST_POST, payload: { page } });
  }, [dispatch, page]);

  useEffect(() => {
    setPostsData((prevPosts) => [...prevPosts, ...posts]);
  }, [posts]);

  const handleScroll = () => {
    if (
      bottomRef.current &&
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 100
    ) {
      dispatch({ type: GET_LIST_POST, payload: { page: page + 1 } });
    }
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div>
      {postsData.map((post) => (
        <div key={post.id}>
          <Post post={post} />
        </div>
      ))}
      {load ? <div>Loading...</div> : null}
      <div ref={bottomRef}></div>
    </div>
  );
};

export default Posts;
