package com.dbsync.quartz;

import javax.sql.DataSource;

import org.quartz.JobDetail;
import org.quartz.SimpleTrigger;
import org.quartz.Trigger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.quartz.JobDetailFactoryBean;
import org.springframework.scheduling.quartz.SchedulerFactoryBean;
import org.springframework.scheduling.quartz.SimpleTriggerFactoryBean;
import org.springframework.scheduling.quartz.SpringBeanJobFactory;

@Configuration
public class SpringQuartzConfig {
    // @Autowired
    // private ApplicationContext applicationContext;
        
    // @Value("${com.sync.prop.syncinterval}")
    // private int syncInterval;
    
    // @Bean
    // public JobDetailFactoryBean jobDetail() {
    //     JobDetailFactoryBean jobDetailFactory = new JobDetailFactoryBean();
    //     jobDetailFactory.setJobClass(QuartzSyncJob.class);
    //     jobDetailFactory.setDescription("Invoke Sample Job service...");
    //     jobDetailFactory.setDurability(true);
    //     return jobDetailFactory;
    // }

    // @Bean
    // public SimpleTriggerFactoryBean trigger(JobDetail job) {
    //     SimpleTriggerFactoryBean trigger = new SimpleTriggerFactoryBean();
    //     trigger.setJobDetail(job);
    //     trigger.setRepeatInterval(1);
    //     trigger.setRepeatCount(SimpleTrigger.REPEAT_INDEFINITELY);
    //     return trigger;
    // }

    // @Bean
    // public SchedulerFactoryBean scheduler(Trigger trigger, JobDetail job, DataSource quartzDataSource) {
    //     System.out.println("Scheduler Factory Bean ");
    //     SchedulerFactoryBean schedulerFactory = new SchedulerFactoryBean();
    //     schedulerFactory.setConfigLocation(new ClassPathResource("quartz.properties"));

    //     schedulerFactory.setJobFactory(springBeanJobFactory());
    //     schedulerFactory.setJobDetails(job);
    //     schedulerFactory.setTriggers(trigger);
    //     schedulerFactory.setDataSource(quartzDataSource);
    //     return schedulerFactory;
    // }

    // @Bean
    // public SpringBeanJobFactory springBeanJobFactory() {
    //     AutoWiringSpringBeanJobFactory jobFactory = new AutoWiringSpringBeanJobFactory();
    //     jobFactory.setApplicationContext(applicationContext);
    //     return jobFactory;
    // }
}
