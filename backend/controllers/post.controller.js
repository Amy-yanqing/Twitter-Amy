import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import { v2 as cloudinary } from "cloudinary";
import Notification from "../models/notification.model.js";

export const getAllPosts = async (req, res) => {

    try {
        const posts = await Post.find()
            .sort({ createdAt: -1 })
            .populate({
                path: "user",
                select: "-password",
            })
            .populate({
                path: "comments.user",
                select: "-password",
            });

        if (posts.length === 0) {
            return res.status(200).json([]);
        }

        res.status(200).json(posts);
    
    } catch (error) {
        console.log("Error in getAllPosts controller: ", error);
        res.status(500).json({ error: "Internal server error" });
    }

}

export const getFollowingPosts = async (req, res) => {
    try {
        const userId = req.user._id;
        const user = await User.findById(userId);
      
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const following = user.following;

        const feedPosts = await Post.find({ user: { $in: following } })
            .sort({ createdAt: -1 })
            .populate({
                path:"user",
                select: "-password",
            })
            .populate({
                path:"comments.user",
                select: "-password",
            })
        res.status(200).json(feedPosts);

    } catch (error) {
        console.log("Error in getFollowingPosts controller: ", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

export const createPost = async (req, res) => {
    try{
        const {text} = req.body;
        let {img} = req.body;
        const userId = req.user._id;
        const user = await User.findById(userId);
        if(!user){
            return res.status(404).json({error:"User not found"});
        }
        if(!text && !img){
            return res.status(400).json({error:"Please provide text or image"});
        }
        if(img){
            const uploadResponse = await cloudinary.uploader.upload(img, {
                folder: "posts",
            });
            img = uploadResponse.secure_url;
        }
        const newPost = await Post.create({
            user: userId,
            text,
            img,
        }); 
        await newPost.save();
        res.status(201).json(newPost);
    } catch(error){
        console.log("Error in createPost controller: ", error);
        res.status(500).json({error:"Internal server error"});
    }
}

export const getUserPosts = async (req, res) => {
    const {username} = req.params;
    const user = await User.findOne({ username });
    if(!user){
        return res.status(404).json({error:"User not found"});
    }
    try {
        const posts = await Post.find({user:user._id})
            .sort({ createdAt: -1 })
            .populate({
                path: "user",
                select: "-password",
            })
            .populate({
                path: "comments.user",
                select: "-password",
            });

        if (posts.length === 0) {
            return res.status(200).json([]);
        }

        res.status(200).json(posts);
        

    }catch(error){
        console.log("Error in getUserPosts controller: ", error);
        res.status(500).json({error:"Internal server error"});
    }

}

export const deletePost = async (req,res) =>{
    const {id} = req.params;
    const userId = req.user._id;
    try{
        const post = await Post.findById(id);
        if(!post){
            return res.status(404).json({error:"post not found"})
        }
        if(post.user.toString()!== userId.toString()){
            return res.status(401).json({error:"You are not authorized to delete this post"})
        }
        await Post.findByIdAndDelete(id);
        res.status(200).json({message:"Post deleted successfully"})
    } catch(error){
        console.log("Error in deletePost controller: ", error);
        res.status(500).json({error:"Internal server error"});
    }
}
export const getLikedPosts = async (req, res) => {
    const userId = req.params.id;
	try {
		const user = await User.findById(userId);
		if (!user) return res.status(404).json({ error: "User not found" });

		const likedPosts = await Post.find({ _id: { $in: user.likedPosts } })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		res.status(200).json(likedPosts);
	} catch (error) {
		console.log("Error in getLikedPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}}

export const likeUnlikePost = async (req, res) => {
    try {
		const userId = req.user._id;
		const { id: postId } = req.params;

		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const userLikedPost = post.likes.includes(userId);

		if (userLikedPost) {
			// Unlike post
			await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
			await User.updateOne({ _id: userId }, { $pull: { likedPosts: postId } });

			const updatedLikes = post.likes.filter((id) => id.toString() !== userId.toString());
			res.status(200).json(updatedLikes);
		} else {
			// Like post
			post.likes.push(userId);
			await User.updateOne({ _id: userId }, { $push: { likedPosts: postId } });
			await post.save();

			const notification = new Notification({
				from: userId,
				to: post.user,
				type: "like",
			});
			await notification.save();

			const updatedLikes = post.likes;
			res.status(200).json(updatedLikes);
		}
	} catch (error) {
		console.log("Error in likeUnlikePost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
   }

export const commentOnPost = async (req, res) => {
    try {
		const { text } = req.body;
		const postId = req.params.id;
		const userId = req.user._id;

		if (!text) {
			return res.status(400).json({ error: "Text field is required" });
		}
		const post = await Post.findById(postId);

		if (!post) {
			return res.status(404).json({ error: "Post not found" });
		}

		const comment = { user: userId, text };

		post.comments.push(comment);
		await post.save();
        const updatedComments = post.comments;

		res.status(200).json(updatedComments);
	} catch (error) {
		console.log("Error in commentOnPost controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}

}