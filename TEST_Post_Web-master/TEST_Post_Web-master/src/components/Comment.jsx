import React, { memo, useEffect, useState } from "react";
import { postApi } from "../api/postApi";
import { faker } from "@faker-js/faker";

const Comment = memo(({ postId }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    const fetchComments = async () => {
      const data = await postApi.getPostComment(postId);
      setComments(data);
    };
    fetchComments();
  }, [postId]);

  const user = {
    avatar:
      "https://images.unsplash.com/photo-1713392899774-5f1c261c4a77?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxlZGl0b3JpYWwtZmVlZHwzNnx8fGVufDB8fHx8fA%3D%3D",
    email: "adam@gmail.com",
  };

  const handleSendComment = () => {
    console.log(123);
    if (!newComment) return;
    const data = {
      id: faker.datatype.uuid(),
      ...user,
      body: newComment,
    };
    setComments((prev) => [data, ...prev]);
    setNewComment("");
  };

  return (
    <div className="w-full">
      <p>{comments.length} replies</p>
      <div className="border-t-2 flex flex-col gap-10 py-5">
        {comments.map((comment) => (
          <div key={comment.id}>
            <div className="flex flex-row gap-5">
              <img
                src={comment?.avatar || faker.image.avatar()}
                alt="avt"
                className="w-10 h-10 object-cover rounded-full"
              />
              <p className="font-bold">{comment.email}</p>
            </div>

            <p>{comment.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 mt-5">
        <div className="flex flex-row gap-5">
          <img
            src={user.avatar}
            alt="avt"
            className="w-10 h-10 object-cover rounded-full"
          />
          <p className="font-bold">adam@gmail.com</p>
        </div>
        <input
          placeholder="Add a new comment..."
          className="w-full border-b-1 outline-none border-none"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // e.preventDefault();
              handleSendComment();
            }
          }}
        />
      </div>
    </div>
  );
});

export default Comment;
