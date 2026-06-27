from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables import RunnablePassthrough
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

vector_stores = {}

class IngestRequest(BaseModel):
    session_id: str
    text: str

class QueryRequest(BaseModel):
    session_id: str
    question: str

@app.post("/ingest")
async def ingest(req: IngestRequest):
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50
    )
    chunks = splitter.split_text(req.text)
    
    embeddings = OpenAIEmbeddings()
    vector_store = FAISS.from_texts(chunks, embeddings)
    vector_stores[req.session_id] = vector_store
    
    return {"status": "success", "chunks": len(chunks)}

@app.post("/query")
async def query(req: QueryRequest):
    if req.session_id not in vector_stores:
        return {"error": "Session not found. Please extract page first!"}
    
    vector_store = vector_stores[req.session_id]
    retriever = vector_store.as_retriever()
    
    llm = ChatOpenAI(model="gpt-3.5-turbo", temperature=0)
    
    prompt = ChatPromptTemplate.from_template("""
    Answer the question based only on the context below.
    
    Context: {context}
    
    Question: {question}
    """)
    
    def format_docs(docs):
        return "\n\n".join(doc.page_content for doc in docs)
    
    chain = (
        {"context": retriever | format_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    
    answer = chain.invoke(req.question)
    return {"answer": answer}

@app.get("/")
async def root():
    return {"status": "Backend is running!"}