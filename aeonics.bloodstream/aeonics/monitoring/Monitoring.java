package aeonics.monitoring;

import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

import aeonics.Boot;
import aeonics.data.Data;
import aeonics.entity.Registry;
import aeonics.entity.Storage;
import aeonics.manager.Config;
import aeonics.manager.Logger;
import aeonics.manager.Manager;
import aeonics.manager.Monitor;
import aeonics.manager.Scheduler;

/**
 * Data is stored in a storage with subfolders that are unix times in ms.
 * 
 * Level 1 is the boot time Boot.BOOT_TIME so that all monitoring sessions are separated
 * Level 2 is the year (to keep things tidy)
 * Level 3 is file per day named after "[month].[day]" including leading zeroes (so max 366)
 * 
 * Level 3' is "_day" (for the current unfinished day)
 * Level 4 is file per hour named after "[hour]" including leading zeroes and using 24h format (so max 24)
 * 
 * Level 3' is "_hour" (for the current unfinished hour)
 * Level 4 is file per 10 seconds named after "[minute].[seconds]" including leading zeroes (so max 360)
 */
public class Monitoring 
{
	private AtomicBoolean enabled = new AtomicBoolean(false);
	public void setup()
	{
		Manager.of(Config.class).watch(Monitor.class, "enabled", (key, value) ->
		{
			enabled.set(value.asBool());
			
			if( mx.isThreadCpuTimeSupported() )
			{
				mx.setThreadCpuTimeEnabled(enabled.get());
				Manager.of(Logger.class).config(Monitor.class, "Thread activity monitoring enabled: " + enabled);
			}
			if( mx.isThreadContentionMonitoringSupported() )
			{
				mx.setThreadContentionMonitoringEnabled(enabled.get());
				Manager.of(Logger.class).config(Monitor.class, "Thread contention monitoring enabled: " + enabled);
			}
		});
		
		// next multiple of 10sec
		ZonedDateTime first = ZonedDateTime.ofInstant(
			Instant.ofEpochSecond(
				((ZonedDateTime.now().toEpochSecond() / 10) + 1) * 10
			),
			ZonedDateTime.now().getZone()
		);
		
		Manager.of(Scheduler.class).every(this::tick, 10, ChronoUnit.SECONDS, first);
	}
	
	/**
	 * Prints the number on 2 digits with eventual leading zero if needed
	 * @param value the number
	 * @return number with leading zero
	 */
	private String leadingZeroes(int value)
	{
		if( value >= 10 ) return String.valueOf(value);
		else if( value >= 1 ) return "0" + value;
		else return "00";
	}
	
	/**
	 * Get the storage for monitoring
	 * @return the storage
	 */
	private Storage.Type storage()
	{
		return Registry.of(Storage.class).get(Manager.of(Config.class).get(Monitor.class, "storage").asString());
	}
	
	/**
	 * Clean the intermediate daily and hourly values if needed
	 * @param time the current time
	 */
	private void cleanupIfNeeded(ZonedDateTime time)
	{
		Data meta = storage().getData(".metadata");
		
		boolean dayChanged = meta == null || meta.isEmpty() || 
			meta.asInt("year") != time.getYear() ||
            meta.asInt("month") != time.getMonthValue() ||
            meta.asInt("day") != time.getDayOfMonth();

		boolean hourChanged = dayChanged ||
			meta.asInt("hour") != time.getHour();

		if( dayChanged ) storage().put(".day", Data.map());
		if( hourChanged ) storage().put(".hour", Data.map());
		if( dayChanged || hourChanged )
			storage().put(".metadata", Data.map()
				.put("boot", Boot.BOOT_TIME)
				.put("year", time.getYear())
				.put("month", time.getMonthValue())
				.put("day", time.getDayOfMonth())
				.put("hour", time.getHour())
				);
	}
	
	private synchronized void tick(ZonedDateTime time)
	{
		if( !enabled.get() ) return;
		
		try
		{
			Data data = getThreadCPU(); // get data asap
			
			time = time.minusSeconds(1);
			cleanupIfNeeded(time);
			
			Storage.Type s = storage();
			String key = "m" + leadingZeroes(time.getMinute()) + "s" + leadingZeroes(time.getSecond()/10*10);
			s.put(".hour", s.getData(".hour").put(key, data));
			
			if( time.getMinute() == 59 && time.getSecond() >= 50 )
				aggregateHourly(time);
		}
		catch(Exception e)
		{
			Manager.of(Logger.class).info(Monitoring.class, e);
		}
	}
	
	private void aggregateHourly(ZonedDateTime time)
	{
		Storage.Type s = storage();
		Data hour = s.getData(".hour");
		
		Data threads = Data.map();
		int samples = 0;
		for( int minute = 0; minute < 60; minute++ )
		{
			for( int second = 0; second < 6; second++ )
			{
				String key = "m" + minute + "s" + second + "0";
				Data data = hour.get(key);
				if( data == null || data.isEmpty() ) continue;
				
				samples++;
				
				for( Map.Entry<String, Data> id : data.entrySet() )
				{
					Data values = id.getValue();
					Data t = threads.get(id.getKey());
					
					if( t == null || !t.isMap() )
					{
						t = Data.map()
							.put("name", id.getValue().get("name"))
							.put("samples",  0)
							.put("cpu_time", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("var", 0))
							.put("blocked_count", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("var", 0))
							.put("blocked_time", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("var", 0))
							.put("waited_count", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("var", 0))
							.put("waited_time", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("var", 0))
							;
						threads.put(id.getKey(), t);
					}
					
					long v = values.asLong("cpu_time");
					Data x = t.get("cpu_time");
					x.put("sum", x.asLong("sum") + v);
					long delta = v - x.asLong("avg");
					x.put("avg", x.asLong("avg") + (delta / samples));
					x.put("var", x.asLong("var") + (delta * (v - x.asLong("avg"))));
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = values.asLong("blocked_count");
					x = t.get("blocked_count");
					x.put("sum", x.asLong("sum") + v);
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = values.asLong("blocked_time");
					x = t.get("blocked_time");
					x.put("sum", x.asLong("sum") + v);
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = values.asLong("waited_count");
					x = t.get("waited_count");
					x.put("sum", x.asLong("sum") + v);
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
					
					v = values.asLong("waited_time");
					x = t.get("waited_time");
					x.put("sum", x.asLong("sum") + v);
					if( x.asLong("min") > v ) x.put("min", v);
					if( x.asLong("max") < v ) x.put("max", v);
				}
			}
		}
		
		for( Data t : threads )
		{
			t.put("samples", samples);
			
			Data x = t.get("cpu_time");
			x.put("std", Math.sqrt(x.remove("var").asLong() / samples));
			
			x = t.get("blocked_count");
			x.put("std", Math.sqrt(x.remove("var").asLong() / samples));
			
			x = t.get("blocked_time");
			x.put("std", Math.sqrt(x.remove("var").asLong() / samples));
			
			x = t.get("waited_count");
			x.put("std", Math.sqrt(x.remove("var").asLong() / samples));
			
			x = t.get("waited_time");
			x.put("std", Math.sqrt(x.remove("var").asLong() / samples));
		}
		
		s.put(".day", s.getData(".day").put("h" + leadingZeroes(time.getHour()), threads));
		
		if( time.getHour() >= 23 )
			aggregateDaily(time);
	}
	
	private void aggregateDaily(ZonedDateTime time)
	{
		Storage.Type s = storage();
		Data all = s.getData(".day");
		
		Data threads = Data.map();
		for( int hour = 0; hour < 24; hour++ )
		{
			Data data = all.get("h" + leadingZeroes(hour));
			if( data == null || data.isEmpty() ) continue;
			
			for( Map.Entry<String, Data> id : data.entrySet() )
			{
				Data values = id.getValue();
				Data t = threads.get(id.getKey());
				
				if( t == null || !t.isMap() )
				{
					t = Data.map()
						.put("name", id.getValue().get("name"))
						.put("samples",  0)
						.put("cpu_time", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("tmp1",  0).put("tmp2",  0))
						.put("blocked_count", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("tmp1",  0).put("tmp2",  0))
						.put("blocked_time", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("tmp1",  0).put("tmp2",  0))
						.put("waited_count", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("tmp1",  0).put("tmp2",  0))
						.put("waited_time", Data.map().put("sum", 0).put("min", 0).put("max", 0).put("avg", 0).put("std", 0).put("tmp1",  0).put("tmp2",  0))
						;
					threads.put(id.getKey(), t);
				}
				
				long v = values.asLong("samples");
				t.put("samples", t.asLong("samples") + v);
				
				Data x = t.get("cpu_time");
				x.put("sum", x.asLong("sum") + values.get("cpu_time").asLong("sum"));
				x.put("tmp1", x.asLong("tmp1") + values.asLong("sample") * values.get("cpu_time").asLong("avg"));
				x.put("tmp2", x.asLong("tmp2") + values.asLong("sample") * (values.get("cpu_time").asLong("std") * values.get("cpu_time").asLong("std") + values.get("cpu_time").asLong("avg") * values.get("cpu_time").asLong("avg")));
				if( x.asLong("min") > values.get("cpu_time").asLong("min") ) x.put("min", values.get("cpu_time").asLong("min"));
				if( x.asLong("max") < values.get("cpu_time").asLong("max") ) x.put("max", values.get("cpu_time").asLong("max"));
				
				x = t.get("blocked_count");
				x.put("sum", x.asLong("sum") + values.get("blocked_count").asLong("sum"));
				x.put("tmp1", x.asLong("tmp1") + values.asLong("sample") * values.get("blocked_count").asLong("avg"));
				x.put("tmp2", x.asLong("tmp2") + values.asLong("sample") * (values.get("blocked_count").asLong("std") * values.get("blocked_count").asLong("std") + values.get("blocked_count").asLong("avg") * values.get("blocked_count").asLong("avg")));
				if( x.asLong("min") > values.get("blocked_count").asLong("min") ) x.put("min", values.get("blocked_count").asLong("min"));
				if( x.asLong("max") < values.get("blocked_count").asLong("max") ) x.put("max", values.get("blocked_count").asLong("max"));
				
				x = t.get("blocked_time");
				x.put("sum", x.asLong("sum") + values.get("blocked_time").asLong("sum"));
				x.put("tmp1", x.asLong("tmp1") + values.asLong("sample") * values.get("blocked_time").asLong("avg"));
				x.put("tmp2", x.asLong("tmp2") + values.asLong("sample") * (values.get("blocked_time").asLong("std") * values.get("blocked_time").asLong("std") + values.get("blocked_time").asLong("avg") * values.get("blocked_time").asLong("avg")));
				if( x.asLong("min") > values.get("blocked_time").asLong("min") ) x.put("min", values.get("blocked_time").asLong("min"));
				if( x.asLong("max") < values.get("blocked_time").asLong("max") ) x.put("max", values.get("blocked_time").asLong("max"));
				
				x = t.get("waited_count");
				x.put("sum", x.asLong("sum") + values.get("waited_count").asLong("sum"));
				x.put("tmp1", x.asLong("tmp1") + values.asLong("sample") * values.get("waited_count").asLong("avg"));
				x.put("tmp2", x.asLong("tmp2") + values.asLong("sample") * (values.get("waited_count").asLong("std") * values.get("waited_count").asLong("std") + values.get("waited_count").asLong("avg") * values.get("waited_count").asLong("avg")));
				if( x.asLong("min") > values.get("waited_count").asLong("min") ) x.put("min", values.get("waited_count").asLong("min"));
				if( x.asLong("max") < values.get("waited_count").asLong("max") ) x.put("max", values.get("waited_count").asLong("max"));
				
				x = t.get("waited_time");
				x.put("sum", x.asLong("sum") + values.get("waited_time").asLong("sum"));
				x.put("tmp1", x.asLong("tmp1") + values.asLong("sample") * values.get("waited_time").asLong("avg"));
				x.put("tmp2", x.asLong("tmp2") + values.asLong("sample") * (values.get("waited_time").asLong("std") * values.get("waited_time").asLong("std") + values.get("waited_time").asLong("avg") * values.get("waited_time").asLong("avg")));
				if( x.asLong("min") > values.get("waited_time").asLong("min") ) x.put("min", values.get("waited_time").asLong("min"));
				if( x.asLong("max") < values.get("waited_time").asLong("max") ) x.put("max", values.get("waited_time").asLong("max"));
			}
		}
		
		for( Data t : threads )
		{
			Data x = t.get("cpu_time");
			long tmp1 = x.remove("tmp1").asLong();
			long tmp2 = x.remove("tmp2").asLong();
			x.put("avg", tmp1 / t.asLong("samples"));
			x.put("std", Math.sqrt((tmp2 / t.asLong("samples")) - (x.asLong("avg") * x.asLong("avg"))));
			
			x = t.get("blocked_count");
			tmp1 = x.remove("tmp1").asLong();
			tmp2 = x.remove("tmp2").asLong();
			x.put("avg", tmp1 / t.asLong("samples"));
			x.put("std", Math.sqrt((tmp2 / t.asLong("samples")) - (x.asLong("avg") * x.asLong("avg"))));
			
			x = t.get("blocked_time");
			tmp1 = x.remove("tmp1").asLong();
			tmp2 = x.remove("tmp2").asLong();
			x.put("avg", tmp1 / t.asLong("samples"));
			x.put("std", Math.sqrt((tmp2 / t.asLong("samples")) - (x.asLong("avg") * x.asLong("avg"))));
			
			x = t.get("waited_count");
			tmp1 = x.remove("tmp1").asLong();
			tmp2 = x.remove("tmp2").asLong();
			x.put("avg", tmp1 / t.asLong("samples"));
			x.put("std", Math.sqrt((tmp2 / t.asLong("samples")) - (x.asLong("avg") * x.asLong("avg"))));
			
			x = t.get("waited_time");
			tmp1 = x.remove("tmp1").asLong();
			tmp2 = x.remove("tmp2").asLong();
			x.put("avg", tmp1 / t.asLong("samples"));
			x.put("std", Math.sqrt((tmp2 / t.asLong("samples")) - (x.asLong("avg") * x.asLong("avg"))));
		}
		
		Data year = s.getData(time.getYear() + ".json");
		if( year == null ) year = Data.map();
		
		s.put(time.getYear() + ".json", year.put("m" + leadingZeroes(time.getMonthValue()) + "d" + leadingZeroes(time.getDayOfMonth()), threads));
	}
	
	private ThreadMXBean mx = ManagementFactory.getThreadMXBean();
	private Map<Long, long[]> _previousThreadInfo = new HashMap<>();
	private synchronized Data getThreadCPU()
	{
		ThreadGroup group = Thread.currentThread().getThreadGroup().getParent();
		Thread[] threads = new Thread[group.activeCount()];
		group.enumerate(threads, true);
		
		// if you want all threads, you should use: 
		// Arrays.stream(mx.getAllThreadIds()).boxed().collect(Collectors.toList());
		
		List<Long> ids = Arrays.stream(threads).mapToLong(t -> t.getId()).boxed().collect(Collectors.toList());
		_previousThreadInfo.keySet().retainAll(ids);
		
		Data lvl1 = Data.map();
		
		for( long threadId : ids )
		{
			ThreadInfo info = mx.getThreadInfo(threadId);
			if( info == null ) continue;
			
			if( !lvl1.containsKey(""+threadId) )
				lvl1.put(""+threadId, Data.map().put("name", info.getThreadName()));
			Data lvl2 = lvl1.get(""+threadId);
			
			// [0] = cpu time
			// [1] = contention count
			// [2] = contention time
			// [3] = wait count
			// [4] = wait time
			long[] previous = _previousThreadInfo.computeIfAbsent(threadId, (key) -> new long[] { 0, 0, 0, 0, 0 });
			long past = 0;
			
			if( mx.isThreadCpuTimeSupported() && mx.isThreadCpuTimeEnabled() )
			{
				past = previous[0];
				previous[0] = mx.getThreadCpuTime(threadId);  // nanoseconds
				lvl2.put("cpu_time", previous[0] - past);
			}
			
			if( mx.isThreadContentionMonitoringSupported() && mx.isThreadContentionMonitoringEnabled() )
			{
				past = previous[1];
				previous[1] = info.getBlockedCount();
				lvl2.put("blocked_count", previous[1] - past);
				
				past = previous[2];
				previous[2] = info.getBlockedTime();  // milliseconds
				lvl2.put("blocked_time", (previous[2] - past) * 1_000_000);
				
				past = previous[3];
				previous[3] = info.getWaitedCount();
				lvl2.put("waited_count", previous[3] - past);
				
				past = previous[4];
				previous[4] = info.getWaitedTime(); // milliseconds
				lvl2.put("waited_time", (previous[4] - past) * 1_000_000);
			}
		}
		
		return lvl1;
	}
}
