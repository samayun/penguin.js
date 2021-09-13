build:
	docker build . -t samayun/penguin

start:
	docker run -p 8080:8080 -d samayun/penguin

run:
	docker run -p 8080:8080 samayun/penguin

kill:
	sudo killall node