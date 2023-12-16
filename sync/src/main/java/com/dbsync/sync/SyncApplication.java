package com.dbsync.sync;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.scheduling.annotation.EnableScheduling;

import com.dbsync.quartz.MyScheduler;

@SpringBootApplication
@EnableScheduling
@ComponentScan("com.dbsync")
public class SyncApplication {
	static final Logger logger = LoggerFactory.getLogger(SyncApplication.class);

	public static void main(String[] args) {
		logger.info("Starting the db sync project");
		SpringApplication.run(SyncApplication.class, args);
		logger.info("Started the db sync project");
		//new MyScheduler().startJob();
	}

}
