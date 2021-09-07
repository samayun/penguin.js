createImage:
	docker build -t penguin .

run:
	docker run -p 5000:5000 -d penguin