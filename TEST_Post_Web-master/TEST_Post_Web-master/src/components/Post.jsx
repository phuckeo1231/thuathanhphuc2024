import React, { memo, useEffect, useState } from "react";
import { userApi } from "../api/userApi";
import Comment from "./Comment";
import { faker } from "@faker-js/faker";
import moment from "moment";

const Post = memo(({ post }) => {
  const [user, setUser] = useState(null);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await userApi.getUser(post.userId);
      setUser(user);
    };
    fetchUser();
  }, [post.userId]);

  return (
    <div className="flex flex-col justify-center gap-3 p-5 border-b-2 max-w-[800px] mx-auto">
      <p className="text-2xl text-center font-bold">{post.title}</p>

      <div>
        <p>Author: {user?.name}</p>
        <p>Created at: {moment(faker.date.anytime()).format("l")}</p>
      </div>

      <p
        className={`${!showMore && "truncate"} text-center text-xl
      font-semibold mt-5`}
      >
        {post.body}
      </p>
      <button
        onClick={() => setShowMore(!showMore)}
        className="font-bold text-sky-400"
      >
        {showMore ? "Hidden" : "Show more"}
      </button>

      <Comment postId={post.id} />
    </div>
  );
});

export default Post;
