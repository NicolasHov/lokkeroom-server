import Lobby from '../models/lobby.js';
import User from '../models/user.js';
import Message from '../models/message.js';
import { McpError } from '../middleware/errorHandler.js';
import mongoose from 'mongoose';

export const getAllLobbies = async (req, res, next) => {
    try {
        const lobbies = await Lobby.find()
            .populate('messages')
        res.status(201).json(lobbies);
    } catch (err) {
        next(err);
    }
}

export const addPlayerToLobby = async (req, res, next) => {
    const { lobbyId } = req.params;
    const { playerId } = req.body;

    try {
        const lobby = await Lobby.findById(lobbyId);
        if (!lobby) {
            return next(new McpError(404, 'Lobby not found'));
        }

        const player = await User.findById(playerId);
        if (!player) {
            return next(new McpError(404, 'Player not found'));
        }

        if (lobby.players.includes(playerId)) {
            return next(new McpError(409, 'Player already in lobby'));
        }

        lobby.players.push(playerId);
        await lobby.save();
        res.json({ message: 'Player added to lobby!', lobby });
    } catch (err) {
        next(err);
    }
};

export const createLobbyWithMessages = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const coachId = req.userId;
        const author = await User.findById(coachId);
        if (!author) {
            return next(new McpError(404, 'Coach not found'));
        }
        const lobby = new Lobby({
            coach: coachId,
            players: [],
            title: req.body.title || `New Lobby of ${author.username}`
        });

        await lobby.save({ session });
        console.log(lobby); // debug

        // Create messages if provided in the request
        if (req.body.messages && Array.isArray(req.body.messages)) {
            for (const messageData of req.body.messages) {
                const message = new Message({
                    player: coachId, // Assuming the coach is sending the first message
                    lobby: lobby._id,
                    content: messageData.content
                });
                await message.save({ session });
            }
        }

        await session.commitTransaction();
        res.status(201).json({ message: 'Lobby and messages created!', lobbyId: lobby._id });
        console.log(lobby) // debug

    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};


