package com.dbsync.quartz;

import org.quartz.JobBuilder;
import org.quartz.JobDetail;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleScheduleBuilder;
import org.quartz.SimpleTrigger;
import org.quartz.Trigger;
import org.quartz.TriggerBuilder;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.quartz.SchedulerFactoryBean;

@Configuration
public class QuartzConfig {
    
    @Value("${com.sync.prop.syncinterval}")
    private int syncInterval;

    @Bean
    public JobDetail jobDetail() {
        JobDetail jobDetail = JobBuilder.newJob().ofType(QuartzSyncJob.class)
        .storeDurably()
        .withIdentity("QuartzJobDetail_DBSync")  
        .withDescription("Invoke DB Sync Job service...")
        .build();

        return jobDetail;
    }

    @Bean
    public Trigger trigger(JobDetail job) {
        return TriggerBuilder.newTrigger().forJob(job)
        .withIdentity("QuartzTrigger_DBSync")
        .withDescription("DB Sync trigger")
        .withSchedule(SimpleScheduleBuilder.simpleSchedule().repeatForever().withIntervalInMilliseconds(syncInterval))
        .build();
    }

    // @Bean
    // public Scheduler scheduler(Trigger trigger, JobDetail job, SchedulerFactoryBean factory) 
    // throws SchedulerException {
    //     Scheduler scheduler = factory.getScheduler();
    //     scheduler.scheduleJob(job, trigger);
    //     scheduler.start();
    //     return scheduler;
    // }


}
