import asyncio
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient


load_dotenv("backend/.env")


async def test_connection():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])

    try:
        result = await client.admin.command("ping")
        print("MongoDB connection successful!")
        print(result)
    finally:
        client.close()


asyncio.run(test_connection())