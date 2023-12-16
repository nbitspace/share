package com.dbsync.quartz;

import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.impl.StdSchedulerFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

@Service
public class MyScheduler {
	static final Logger logger = LoggerFactory.getLogger(MyScheduler.class);

    // @Autowired
    // private Scheduler scheduler;

    @PostConstruct
    public void startJob() {
        try {
            //scheduler = StdSchedulerFactory.getDefaultScheduler();

            logger.info("MyScheduler.startJob");
            // System.out.println("MyScheduler.startJob");
            // scheduler.start();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void stopJob() {
        try {
            //scheduler.shutdown();
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}

